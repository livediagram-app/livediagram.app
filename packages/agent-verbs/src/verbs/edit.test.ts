import { describe, expect, it } from 'vitest';
import type { ChangesetRequest } from '@livediagram/api-schema';
import { parseEditOperations } from '@livediagram/edit-operations';
import { argvToOperationLine } from '../argv-line';
import { VerbRefusal } from '../define';
import { contextOf, DOC_A, fakeApi, library, tabsOfA } from '../testing/fake-api';
import { memoryCopies } from '../testing/memory-copies';
import { box, plainTab, tabAnswer } from '../testing/tabs';
import { changesetApply, elementVerbs, tabDiff } from './edit';
import { tabView } from './tab';

const TAB = `/documents/${DOC_A}/tabs/tab-one-0000`;
const written = {
  dryRun: false,
  changeset: { id: 'cs_1', tabId: 'tab-one-0000', rev: 6, previousRev: 5, rebasedOver: 1 },
  results: [],
  text: '- n1  square "A"\nrev 5→6 · cs_1 · lint clean · revert: livediagram changeset revert d cs_1',
  warnings: [],
  lint: null,
};

function recording() {
  const requests: ChangesetRequest[] = [];
  const route = async (request: Request) => {
    requests.push(JSON.parse(await request.text()) as ChangesetRequest);
    return Response.json(written);
  };
  return { requests, api: fakeApi({ ...library, ...tabsOfA, [`${TAB}/changesets`]: route }) };
}

// Words as a shell splits them: spaces separate, double quotes group.
const shellWords = (text: string) =>
  [...text.matchAll(/(?:[^\s"]+|"[^"]*")+/g)].map((m) => m[0].replace(/"/g, ''));

describe('changeset apply', () => {
  it("sends a file as the body its content calls for, and prints the api's lines", async () => {
    const { requests, api } = recording();
    const files: Record<string, string> = {
      'ops.txt': 'rm n1\n',
      'arch.json': '{"nodes":[{"id":"a"}]}',
    };
    const ctx = contextOf(api, [], [], { readInput: async (p) => files[p]! });
    const out = await changesetApply.run!(
      ctx,
      changesetApply.input.parse({ doc: 'Auth flow', file: 'ops.txt' }),
    );
    await changesetApply.run!(
      ctx,
      changesetApply.input.parse({ doc: 'Auth flow', file: 'arch.json', summary: 'Arch' }),
    );
    expect(requests).toEqual([
      { operations: 'rm n1\n' },
      { replace: { graph: { nodes: [{ id: 'a' }] } }, summary: 'Arch' },
    ]);
    expect(changesetApply.text!(out)).toEqual([written.text]);
    expect(changesetApply.quiet!(out)).toEqual(['cs_1']);
    expect(changesetApply.quiet!({ ...out, changeset: null })).toEqual([]);
  });

  it('refuses a file it cannot tell, naming it or stdin', async () => {
    const ctx = contextOf(fakeApi({}), [], [], { readInput: async () => '{"name":"x"}' });
    for (const [file, named] of [
      ['x.json', 'x.json'],
      ['-', 'stdin'],
    ] as const) {
      const err = await changesetApply.run!(
        ctx,
        changesetApply.input.parse({ doc: 'd', file }),
      ).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(VerbRefusal);
      expect(err).toMatchObject({ status: 400, message: `can't tell what ${named} holds` });
    }
  });
});

describe('the element verbs', () => {
  it('send their words as one operation line', async () => {
    const { requests, api } = recording();
    const connect = elementVerbs.find((v) => v.id === 'element.connect')!;
    await connect.run!(
      contextOf(api),
      connect.input.parse({
        doc: 'Auth flow',
        words: ['n1', 'n2', 'label=calls it'],
        dryRun: false,
      }),
    );
    expect(requests).toEqual([{ operations: 'connect n1 -> n2 label="calls it"' }]);
  });

  it('are seven, rm destructive, and every example parses', () => {
    expect(elementVerbs.map((v) => v.id)).toEqual([
      'element.add',
      'element.set',
      'element.rm',
      'element.move',
      'element.connect',
      'element.insert',
      'element.wrap',
    ]);
    expect(elementVerbs.filter((v) => v.behaviour === 'destructive').map((v) => v.id)).toEqual([
      'element.rm',
    ]);
    for (const verb of elementVerbs) {
      const op = verb.id.slice('element.'.length);
      for (const example of verb.cli!.examples) {
        const words = shellWords(example)
          .slice(4)
          .filter((w) => w !== '--dry-run');
        expect(parseEditOperations(argvToOperationLine(op, words)), example).toHaveProperty(
          'operations',
        );
      }
      const out = { text: 't', dryRun: true, changeset: null };
      expect(verb.text!(out)).toEqual(['t']);
      expect(verb.quiet!(out)).toEqual([]);
      expect(verb.quiet!({ ...out, changeset: { id: 'cs_2', rev: 1 } })).toEqual(['cs_2']);
    }
  });
});

describe('tab diff', () => {
  it('compares the read copy at --since with the tab now, and keeps the new read', async () => {
    const copies = memoryCopies();
    await copies.record(DOC_A, 'tab-one-0000', { rev: 4, tab: plainTab([box('n1', 'A')]) });
    const now = plainTab([box('n1', 'A2'), box('n2', 'B', 200)]);
    const api = fakeApi({ ...library, ...tabsOfA, [TAB]: tabAnswer(now, 6) });
    const out = await tabDiff.run!(
      contextOf(api, [], [], { copies }),
      tabDiff.input.parse({ doc: 'Auth flow', since: '4', budget: '500' }),
    );
    expect(out.text).toContain('n2');
    expect(out.text).toContain('"A"');
    expect(tabDiff.text!(out)).toEqual([out.text]);
    expect(tabDiff.json!(out)).toBe(out.json);
    expect(await copies.revisions(DOC_A, 'tab-one-0000')).toEqual([4, 6]);
    const whole = await tabDiff.run!(contextOf(api, [], [], { copies }), {
      doc: 'Auth flow',
      since: 4,
    });
    expect(whole.text).toBe(out.text);
  });

  it('refuses a revision it holds no copy of, naming the ones it holds', async () => {
    const copies = memoryCopies();
    await copies.record(DOC_A, 'tab-one-0000', { rev: 2, tab: plainTab([]) });
    const api = fakeApi({ ...library, ...tabsOfA });
    const err = await tabDiff.run!(contextOf(api, [], [], { copies }), {
      doc: 'Auth flow',
      since: 4,
    }).catch((e: unknown) => e);
    expect(err).toMatchObject({
      status: 404,
      message: 'no copy of rev 4; tab diff compares against a revision this CLI has read',
      lines: ['read copies: rev 2'],
      hint: 'livediagram tab view "Auth flow" --tab "Overview"',
    });
    const none = await tabDiff.run!(contextOf(api), { doc: 'Auth flow', since: 4 }).catch(
      (e: unknown) => e,
    );
    expect(none).toMatchObject({ lines: ['no read copies of this tab'] });
  });

  it('fails plainly when the tab read carries no revision', async () => {
    const copies = memoryCopies();
    await copies.record(DOC_A, 'tab-one-0000', { rev: 4, tab: plainTab([]) });
    const api = fakeApi({ ...library, ...tabsOfA, [TAB]: { tab: plainTab([]) } });
    await expect(
      tabDiff.run!(contextOf(api, [], [], { copies }), { doc: 'Auth flow', since: 4 }),
    ).rejects.toThrow('the tab read carried no revision');
  });
});

describe('tab view and read copies', () => {
  const view = (rev: number) => () =>
    new Response('tab "Overview"', { headers: { ETag: `W/"${rev}"` } });

  it('keeps the plain tab read beside a view when both name one revision', async () => {
    const copies = memoryCopies();
    const tab = plainTab([box('n1', 'A')]);
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [`${TAB}?view=outline`]: view(5),
      [TAB]: tabAnswer(tab, 5),
    });
    const logs: string[] = [];
    await tabView.run!(
      contextOf(api, [], logs, { copies }),
      tabView.input.parse({ doc: 'Auth flow' }),
    );
    expect(await copies.latest(DOC_A, 'tab-one-0000')).toEqual({ rev: 5, tab });
    expect(logs.at(-1)).toBe(`copy recorded ${DOC_A}/tab-one-0000 rev 5`);
  });

  it('repeats a plain read that raced a write once, and keeps nothing if it still disagrees', async () => {
    const copies = memoryCopies();
    let reads = 0;
    const tab = plainTab([]);
    const racing = () =>
      new Response(JSON.stringify({ tab }), { headers: { ETag: `W/"${++reads === 1 ? 4 : 5}"` } });
    const api = fakeApi({
      ...library,
      ...tabsOfA,
      [`${TAB}?view=outline`]: view(5),
      [TAB]: racing,
    });
    await tabView.run!(
      contextOf(api, [], [], { copies }),
      tabView.input.parse({ doc: 'Auth flow' }),
    );
    expect(await copies.revisions(DOC_A, 'tab-one-0000')).toEqual([5]);
    const logs: string[] = [];
    const stale = fakeApi({
      ...library,
      ...tabsOfA,
      [`${TAB}?view=outline`]: view(7),
      [TAB]: tabAnswer(tab, 6),
    });
    await tabView.run!(
      contextOf(stale, [], logs, { copies }),
      tabView.input.parse({ doc: 'Auth flow' }),
    );
    expect(logs.at(-1)).toBe(`copy skipped ${DOC_A}/tab-one-0000 view rev 7`);
    const unversioned = fakeApi({
      ...library,
      ...tabsOfA,
      [`${TAB}?view=outline`]: { text: 'tab' },
      [TAB]: tabAnswer(tab, 6),
    });
    await tabView.run!(
      contextOf(unversioned, [], [], { copies }),
      tabView.input.parse({ doc: 'Auth flow' }),
    );
    expect(await copies.revisions(DOC_A, 'tab-one-0000')).toEqual([5]);
  });

  it('prints the plain tab with --raw, keeping it as a copy where a store exists', async () => {
    const tab = plainTab([box('n1', 'A')]);
    const api = fakeApi({ ...library, ...tabsOfA, [TAB]: tabAnswer(tab, 5) });
    const copies = memoryCopies();
    const out = await tabView.run!(
      contextOf(api, [], [], { copies }),
      tabView.input.parse({ doc: 'Auth flow', raw: true }),
    );
    expect(tabView.text!(out)).toEqual([JSON.stringify(tab)]);
    expect(await copies.revisions(DOC_A, 'tab-one-0000')).toEqual([5]);
    expect(
      await tabView.run!(contextOf(api), tabView.input.parse({ doc: 'Auth flow', raw: true })),
    ).toEqual({ json: tab });
    const bare = fakeApi({ ...library, ...tabsOfA, [TAB]: { tab } });
    expect(
      await tabView.run!(contextOf(bare), tabView.input.parse({ doc: 'Auth flow', raw: true })),
    ).toEqual({ json: null });
  });
});
