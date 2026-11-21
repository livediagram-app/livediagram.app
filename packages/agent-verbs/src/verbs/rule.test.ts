import { describe, expect, it } from 'vitest';
import { createAddressing } from '../addressing';
import { createApiRefusal } from '../api-refusal';
import { VerbRefusal, type Verb } from '../define';
import { createFind, type FileSummary } from '../find';
import type { FolderNode } from '../folders';
import { createRuleRun } from '../rules';
import { contextOf, DOC_A, fakeApi, TEST_PRODUCT } from '../testing/product';
import { RULES, listOf, listed, runOf } from '../testing/rules';
import { createRuleVerbs, ruleGuide } from './rule';

// The CLI's `rule` verbs (liveworkspace/docs/specs/018-automations/automations.md "Agents"), over the test product:
// the same listing and changes as list_rules and change_rules, a refusal as the verb's with its exit and hint.
const { listAllFiles } = createFind<FileSummary & { ownerId?: string }, FolderNode, 'sketches'>(
  TEST_PRODUCT,
);
const { resolveFile } = createAddressing({ product: TEST_PRODUCT, listAllFiles });
const verbs = createRuleVerbs({
  rules: RULES,
  run: createRuleRun(RULES, createApiRefusal(TEST_PRODUCT)),
  arg: 'doc',
  resolveFile,
});
const verb = (id: string) => verbs.find((v) => v.id === id)! as unknown as Verb;

const BASE = `/sketches/${DOC_A}/automations`;
type Sent = { method: string; path: string; body: unknown };

function api(routes: Record<string, unknown> = {}) {
  const sent: Sent[] = [];
  const ok =
    (answer: unknown, status = 200) =>
    async (request: Request) => {
      const text = await request.text();
      sent.push({
        method: request.method,
        path: new URL(request.url).pathname.replace(/^\/api/, ''),
        body: text ? JSON.parse(text) : undefined,
      });
      return answer === null
        ? new Response(null, { status: 204 })
        : Response.json(answer, { status });
    };
  const client = fakeApi({
    [`/sketches/${DOC_A}`]: { sketch: { id: DOC_A, name: 'Launch', tabs: [] } },
    [BASE]: async (request: Request) =>
      request.method === 'GET'
        ? Response.json(listOf())
        : ok({ rule: listed({ id: 'r2', name: 'New' }) }, 201)(request),
    [`${BASE}/r1`]: async (request: Request) =>
      ok(request.method === 'DELETE' ? null : { rule: listed({ name: 'Renamed' }) })(request),
    [`${BASE}/r1/toggle`]: ok({ rule: listed({ enabled: false }) }),
    [`${BASE}/r1/duplicate`]: ok({ rule: listed({ id: 'r3', name: 'Comments by email copy' }) }),
    [`${BASE}/test`]: ok({ run: runOf({ subject: null }) }),
    [`${BASE}/r1/run`]: ok({ run: runOf() }),
    [`${BASE}/runs?rule=r1&limit=5`]: { runs: [runOf({ reason: 'slow' })] },
    [`${BASE}/runs?limit=20`]: { runs: [] },
    ...routes,
  });
  return { client, sent };
}

const ctxOf = (client: ReturnType<typeof api>['client'], input: Record<string, string> = {}) =>
  contextOf(client, [], [], {
    readInput: async (path: string) => {
      if (path in input) return input[path]!;
      throw new Error(`no file ${path}`);
    },
  });

describe('rule ls, get and log', () => {
  it('lists the rules a line each, with the day’s runs', async () => {
    const { client } = api();
    const out = await verb('rule.ls').run!(ctxOf(client), { doc: DOC_A });
    expect(verb('rule.ls').text!(out)).toEqual([
      'r1  on    never run  0 this week  "Comments by email": When Comment Added then Send Email to the owner',
      'runs today: 3 of 1000',
    ]);
    expect(verb('rule.ls').quiet!(out)).toEqual(['r1']);
    const states = verb('rule.ls').text!({
      rules: [
        {
          ...(out as { rules: object[] }).rules[0],
          on: false,
          needsAttention: ['x'],
          lastRun: '2026-11-01T09:00:00.000Z',
        },
        { ...(out as { rules: object[] }).rules[0], paused: 'failing' },
      ],
      runsToday: 0,
      runsPerDay: 1000,
    });
    expect(states[0]).toMatch(/^r1 +off +needs attention +last 2026-11-01 09:00/);
    expect(states[1]).toMatch(/^r1 {2}paused/);
    expect(verb('rule.ls').text!({ rules: [], runsToday: 0, runsPerDay: 1000 })).toEqual([
      'No rules.',
    ]);
  });

  it('prints one rule’s line, then its body as JSON', async () => {
    const { client } = api();
    const out = await verb('rule.get').run!(ctxOf(client), {
      doc: DOC_A,
      rule: 'Comments by email',
    });
    const lines = verb('rule.get').text!(out);
    expect(lines[0]).toMatch(/^r1 {2}on/);
    expect(JSON.parse(lines[1]!)).toMatchObject({ id: 'r1', trigger: { kind: 'comment_added' } });
    expect(verb('rule.get').quiet!(out)).toEqual(['r1']);
  });

  it('prints the Audit Trail, newest first, or says there are no runs', async () => {
    const { client } = api();
    const one = await verb('rule.log').run!(ctxOf(client), { doc: DOC_A, rule: 'r1', limit: 5 });
    expect(verb('rule.log').text!(one)).toEqual([
      '2026-11-01 09:00:00  done  "Comments by email"  Overview  12 ms  slow',
      '  Ana Costa commented',
      '  ✗ Tab is Retro',
      '  ✓ Sent email to the owner (Already so)',
    ]);
    expect(verb('rule.log').quiet!(one)).toEqual(['run1']);
    const none = await verb('rule.log').run!(ctxOf(client), { doc: DOC_A, limit: 20 });
    expect(verb('rule.log').text!(none)).toEqual(['No runs.']);
    expect(
      verb('rule.log').text!({ runs: [{ ...listedOf(one), tab: null, reason: undefined }] })[0],
    ).toContain('no tab  12 ms');
  });

  it('refuses a rule it cannot name, 404 with the way to list them', async () => {
    const { client } = api();
    const refused = await verb('rule.get').run!(ctxOf(client), { doc: DOC_A, rule: 'Nope' }).catch(
      (e: unknown) => e,
    );
    expect(refused).toBeInstanceOf(VerbRefusal);
    expect(refused).toMatchObject({
      status: 404,
      code: 'rule_unknown',
      hint: 'list the rules with: acme rule ls <doc>',
    });
  });
});

const listedOf = (out: unknown) => (out as { runs: Record<string, unknown>[] }).runs[0]!;

describe('rule add, set, on, off, rm, duplicate, test and run', () => {
  it('adds and sets from JSON files', async () => {
    const { client, sent } = api();
    const files = {
      'new.json': '{"name":"New","trigger":{"kind":"manual"}}',
      'set.json': '{"name":"Renamed"}',
    };
    const added = await verb('rule.add').run!(ctxOf(client, files), {
      doc: DOC_A,
      file: 'new.json',
    });
    expect(verb('rule.add').text!(added)).toEqual(['+ rule r2 "New" (on)']);
    expect(verb('rule.add').quiet!(added)).toEqual(['+ rule r2 "New" (on)']);
    const set = await verb('rule.set').run!(ctxOf(client, files), {
      doc: DOC_A,
      rule: 'r1',
      file: 'set.json',
    });
    expect(verb('rule.set').text!(set)).toEqual(['~ rule "Renamed" changed (on)']);
    expect(sent.map((s) => s.method)).toEqual(['POST', 'PUT']);
  });

  it('turns a rule off and on, copies and deletes it', async () => {
    const { client, sent } = api();
    const ctx = ctxOf(client);
    const lines = [];
    for (const id of ['rule.off', 'rule.on', 'rule.duplicate', 'rule.rm'])
      lines.push(...verb(id).text!(await verb(id).run!(ctx, { doc: DOC_A, rule: 'r1' })));
    expect(lines).toEqual([
      '~ rule "Comments by email" off',
      '~ rule "Comments by email" off',
      '+ rule r3 "Comments by email copy" (off, a copy of "Comments by email")',
      '- rule "Comments by email"',
    ]);
    expect(sent.map((s) => s.body)).toEqual([
      { enabled: false },
      { enabled: true },
      undefined,
      undefined,
    ]);
    expect(verb('rule.rm').behaviour).toBe('destructive');
  });

  it('tests a saved rule or a body from a file, and runs one on a tab', async () => {
    const { client, sent } = api();
    const ctx = ctxOf(client, {
      'DRAFT.JSON': '{"name":"Draft","trigger":{"kind":"manual"}}',
      '-': '{"name":"In","trigger":{"kind":"manual"}}',
    });
    const saved = await verb('rule.test').run!(ctx, { doc: DOC_A, rule: 'r1' });
    expect(verb('rule.test').text!(saved)).toEqual([
      '? tested "Comments by email": Done',
      '  Ana Costa commented',
      '  ✗ Tab is Retro',
      '  ✓ Sent email to the owner (Already so)',
    ]);
    await verb('rule.test').run!(ctx, { doc: DOC_A, rule: 'DRAFT.JSON', tab: 'Retro' });
    await verb('rule.test').run!(ctx, { doc: DOC_A, rule: '-' });
    const ran = await verb('rule.run').run!(ctx, { doc: DOC_A, rule: 'r1', tab: 'Overview' });
    expect(verb('rule.run').text!(ran)[0]).toBe(
      '> ran "Comments by email" on tab "Overview": Done',
    );
    await verb('rule.run').run!(ctx, { doc: DOC_A, rule: 'r1' });
    expect(sent.map((s) => s.body)).toEqual([
      { rule: expect.objectContaining({ name: 'Comments by email' }) },
      { rule: expect.objectContaining({ name: 'Draft' }), tab: 't2' },
      { rule: expect.objectContaining({ name: 'In' }) },
      { tab: 't1' },
      {},
    ]);
  });

  it('refuses a file that is no JSON object, as usage, with the rule format', async () => {
    const { client } = api();
    const ctx = ctxOf(client, { 'list.json': '[1]', 'bad.json': '{' });
    for (const file of ['list.json', 'bad.json', 'missing.json']) {
      const refused = await verb('rule.add').run!(ctx, { doc: DOC_A, file }).catch(
        (e: unknown) => e,
      );
      expect(refused).toMatchObject({ status: 400, code: 'usage' });
      expect((refused as VerbRefusal).hint).toContain('the rule format is change_rules’');
    }
  });

  it('answers each refusal with its exit and hint', async () => {
    const refusing = (error: string, status: number) =>
      api({
        [`${BASE}/r1/toggle`]: () => Response.json({ error }, { status }),
        [`${BASE}/r1/run`]: () => Response.json({ error }, { status }),
      }).client;
    const cases: [string, number, number, string][] = [
      ['automations_need_editor', 403, 403, 'rule ls'],
      ['read_only_token', 403, 403, 'rule ls'],
      ['automation_needs_a_person', 403, 403, 'rule format'],
      ['automation_not_found', 404, 404, 'rule ls'],
      ['automation_invalid', 400, 400, 'rule format'],
    ];
    for (const [code, status, exit, hint] of cases) {
      const refused = await verb('rule.off').run!(ctxOf(refusing(code, status)), {
        doc: DOC_A,
        rule: 'r1',
      }).catch((e: unknown) => e);
      expect(refused, code).toMatchObject({ status: exit, code });
      expect((refused as VerbRefusal).hint, code).toContain(hint);
    }
    const unknown = await verb('rule.on').run!(ctxOf(api().client), {
      doc: DOC_A,
      rule: 'Nope',
    }).catch((e: unknown) => e);
    expect(unknown).toMatchObject({ status: 404, code: 'rule_unknown' });
  });
});

describe('the rules guide', () => {
  it('speaks the product’s CLI and word', () => {
    const { summary, text } = ruleGuide(TEST_PRODUCT);
    expect(summary).toBe('list, add, test and run Automations rules');
    expect(text).toContain('acme rule ls "Launch"');
    expect(text).toContain("an Editor's of the whole sketch");
    expect(ruleGuide({ ...TEST_PRODUCT, word: 'drawing' }).text).toContain(
      'on a drawing by themselves',
    );
  });
});
