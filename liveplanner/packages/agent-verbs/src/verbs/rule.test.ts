import { describe, expect, it } from 'vitest';
import type { AutomationListedRule } from '@liveplanner/api-schema';
import { contextOf, DOC_A, fakeApi, library, tabsOfA } from '../testing/fake-api';
import { CARD, listed, listOf, PLAN, run } from '../testing/rules';
import { VerbRefusal } from '../define';
import {
  ruleAdd,
  ruleDuplicate,
  ruleGet,
  ruleLog,
  ruleLs,
  ruleOff,
  ruleOn,
  ruleRm,
  ruleRun,
  ruleSet,
  ruleTest,
  ruleVerbs,
} from './rule';

// The rule verbs (docs/specs/026-plan/automations.md "Agents and the CLI", docs/specs/015-api/cli.md "Commands").
const base = `/projects/${DOC_A}/automations`;

function ctxWith(
  rules: AutomationListedRule[] = [listed()],
  input: Record<string, string> = {},
  refuse?: { status: number; error: string },
) {
  const sent: string[] = [];
  const write = async (r: Request) => {
    sent.push(`${r.method} ${new URL(r.url).pathname.replace(/^\/api/, '').replace(base, '')}`);
    if (refuse) return Response.json({ error: refuse.error }, { status: refuse.status });
    if (r.method === 'DELETE') return new Response(null, { status: 204 });
    if (r.url.endsWith('/test') || r.url.endsWith('/run')) return Response.json({ run: run() });
    return Response.json({ rule: listed({ id: r.url.endsWith('/duplicate') ? 'r9' : 'r1' }) });
  };
  const api = fakeApi({
    ...library,
    ...tabsOfA,
    [base]: (r: Request) => (r.method === 'GET' ? Response.json(listOf(rules)) : write(r)),
    [`/projects/${DOC_A}/plan`]: PLAN,
    [`/projects/${DOC_A}/items`]: { items: [CARD], rev: 1 },
    [`${base}/runs`]: { runs: [run(), run({ id: 'run2', card: null, reason: 'Chain stopped' })] },
    [`${base}/r1`]: write,
    [`${base}/r1/toggle`]: write,
    [`${base}/r1/duplicate`]: write,
    [`${base}/r1/run`]: write,
    [`${base}/test`]: write,
  });
  const ctx = contextOf(api, [], [], {
    readInput: async (path) => {
      if (path in input) return input[path]!;
      throw new Error(`no input ${path}`);
    },
  });
  return { ctx, sent };
}

describe('rule ls and rule get', () => {
  it('prints a line a rule and the day’s runs, or that there are none', async () => {
    const paused = listed({
      id: 'r2',
      name: 'Nudge',
      enabled: false,
      paused: { reason: 'Webhook gone', at: 0 },
      needs: ['Column qa is gone'],
      stats: { lastRunAt: null, runsThisWeek: 0, failuresInARow: 10 },
    });
    const off = listed({ id: 'r3', name: 'Off', enabled: false });
    const out = await ruleLs.run!(ctxWith([listed(), paused, off]).ctx, { project: DOC_A });
    const lines = ruleLs.text!(out);
    expect(lines[0]).toMatch(
      /^r1\s+on\s+last 2026-11-11 09:00\s+3 this week\s+"Done stamp": When Card Moved to Done then Add Label shipped$/,
    );
    expect(lines[1]).toMatch(/^r2\s+paused\s+needs attention\s+never run\s+0 this week\s+"Nudge"/);
    expect(lines[2]).toMatch(/^r3\s+off\s/);
    expect(lines[3]).toBe('runs today: 4 of 1000');
    expect(ruleLs.quiet!(out)).toEqual(['r1', 'r2', 'r3']);
    const none = await ruleLs.run!(ctxWith([]).ctx, { project: DOC_A });
    expect(ruleLs.text!(none)).toEqual(['No rules.']);
  });

  it('prints one rule’s line then its body, and refuses a rule it cannot name', async () => {
    const out = await ruleGet.run!(ctxWith().ctx, { project: DOC_A, rule: 'done stamp' });
    const lines = ruleGet.text!(out);
    expect(lines[0]).toMatch(/^r1\s+on/);
    expect(JSON.parse(lines[1]!)).toMatchObject({ id: 'r1', trigger: { kind: 'card_moved' } });
    expect(ruleGet.quiet!(out)).toEqual(['r1']);
    await expect(
      ruleGet.run!(ctxWith().ctx, { project: DOC_A, rule: 'Nope' }),
    ).rejects.toMatchObject({
      status: 404,
      code: 'rule_unknown',
      hint: 'list the rules with: liveplanner rule ls <project>',
    });
  });
});

describe('rule add and rule set', () => {
  it('adds a rule and changes one from JSON in a file', async () => {
    const { ctx, sent } = ctxWith([listed()], {
      'new.json': '{"name":"Bug stamp","trigger":{"kind":"manual"}}',
      'steps.json': '{"steps":[{"kind":"flag"}]}',
    });
    const added = await ruleAdd.run!(ctx, { project: DOC_A, file: 'new.json' });
    expect(ruleAdd.text!(added)).toEqual(['+ rule r1 "Done stamp" (on)']);
    expect(ruleAdd.quiet!(added)).toEqual(added.applied);
    const set = await ruleSet.run!(ctx, { project: DOC_A, rule: 'r1', file: 'steps.json' });
    expect(set.applied).toEqual(['~ rule "Done stamp" changed (on)']);
    expect(sent).toEqual(['POST ', 'PUT /r1']);
  });

  it('refuses a file that is not a JSON object, with the format', async () => {
    const { ctx } = ctxWith([listed()], { 'list.json': '[1]', 'bad.json': 'nope' });
    for (const file of ['list.json', 'bad.json'])
      await expect(ruleAdd.run!(ctx, { project: DOC_A, file })).rejects.toMatchObject({
        status: 400,
        code: 'usage',
        message: 'the file is not a JSON object of a rule',
      });
  });

  it('turns an api refusal into the verb’s, with its status and the next command', async () => {
    const cases: [number, string, number, RegExp][] = [
      [403, 'automations_need_editor', 403, /rule ls/],
      [403, 'read_only_token', 403, /rule ls/],
      [404, 'automation_not_found', 404, /rule ls/],
      [409, 'automation_name_taken', 400, /rule get/],
      [400, 'automation_invalid', 400, /rule get/],
      [409, 'other_code', 400, /rule ls/],
    ];
    for (const [status, error, exit, hint] of cases) {
      const { ctx } = ctxWith(
        [listed()],
        { 'r.json': '{"name":"X","trigger":{"kind":"manual"}}' },
        {
          status,
          error,
        },
      );
      const refused = await ruleAdd.run!(ctx, { project: DOC_A, file: 'r.json' }).catch(
        (e: unknown) => e,
      );
      expect(refused, error).toBeInstanceOf(VerbRefusal);
      expect(refused, error).toMatchObject({ status: exit, code: error });
      expect((refused as VerbRefusal).hint, error).toMatch(hint);
    }
  });
});

describe('rule on, off, rm and duplicate', () => {
  it('works one rule each', async () => {
    const { ctx, sent } = ctxWith();
    expect((await ruleOn.run!(ctx, { project: DOC_A, rule: 'r1' })).applied).toEqual([
      '~ rule "Done stamp" on',
    ]);
    await ruleOff.run!(ctx, { project: DOC_A, rule: 'r1' });
    expect((await ruleDuplicate.run!(ctx, { project: DOC_A, rule: 'r1' })).applied[0]).toMatch(
      /^\+ rule r9 /,
    );
    expect((await ruleRm.run!(ctx, { project: DOC_A, rule: 'Done stamp' })).applied).toEqual([
      '- rule "Done stamp"',
    ]);
    expect(sent).toEqual([
      'POST /r1/toggle',
      'POST /r1/toggle',
      'POST /r1/duplicate',
      'DELETE /r1',
    ]);
    expect(ruleRm.behaviour).toBe('destructive');
    expect(ruleOn.behaviour).toBe('write');
  });
});

describe('rule test, rule run and rule log', () => {
  it('tests a saved rule or a body from a file, and runs one, printing the steps', async () => {
    const { ctx, sent } = ctxWith([listed()], {
      'draft.json': '{"name":"Draft","trigger":{"kind":"manual"}}',
      '-': '{"name":"Piped","trigger":{"kind":"manual"}}',
    });
    const tested = await ruleTest.run!(ctx, { project: DOC_A, rule: 'Done stamp', card: '#12' });
    expect(ruleTest.text!(tested)).toEqual([
      '? tested "Done stamp" on #12: Done',
      '  Ana Costa moved #12 to Done',
      '  ✓ Card Type is Bug',
      '  ✓ Add Label shipped (Already so)',
      '  ✗ Move to Done',
      '  ✓ For each Child Card: on 1 related card',
    ]);
    await ruleTest.run!(ctx, { project: DOC_A, rule: 'DRAFT.JSON'.toLowerCase(), card: '12' });
    await ruleTest.run!(ctx, { project: DOC_A, rule: '-', card: '12' });
    const ran = await ruleRun.run!(ctx, { project: DOC_A, rule: 'r1', card: '#12' });
    expect(ran.applied).toEqual(['> ran "Done stamp" on #12: Done']);
    expect(sent).toEqual(['POST /test', 'POST /test', 'POST /test', 'POST /r1/run']);
  });

  it('prints the Audit Trail, a run a line and its steps beneath', async () => {
    const out = await ruleLog.run!(
      ctxWith().ctx,
      ruleLog.input.parse({ project: DOC_A, rule: 'r1', limit: '5' }),
    );
    const lines = ruleLog.text!(out);
    expect(lines[0]).toMatch(/^2026-11-11 09:00:00\s+done\s+"Done stamp"\s+#12 Basket\s+7 ms$/);
    expect(lines[1]).toBe('  Ana Costa moved #12 to Done');
    expect(lines.find((l) => l.includes('no card'))).toMatch(/no card\s+7 ms {2}Chain stopped$/);
    expect(ruleLog.quiet!(out)).toEqual(['run1', 'run2']);
    const all = await ruleLog.run!(ctxWith().ctx, ruleLog.input.parse({ project: DOC_A }));
    expect(all.runs).toHaveLength(2);
    expect(ruleLog.text!({ runs: [] })).toEqual(['No runs.']);
  });

  it('are all in the catalogue’s order', () => {
    expect(ruleVerbs.map((v) => v.id)).toEqual([
      'rule.ls',
      'rule.get',
      'rule.add',
      'rule.set',
      'rule.on',
      'rule.off',
      'rule.rm',
      'rule.duplicate',
      'rule.test',
      'rule.run',
      'rule.log',
    ]);
  });
});
