import { describe, expect, it } from 'vitest';
import { elementFingerprint } from '@livediagram/document';
import type { ChangesetRequest } from '@livediagram/api-schema';
import { baseFromCopy, readPlainTab, recordCopy } from './copies';
import { VerbRefusal } from './define';
import { contextOf, DOC_A, fakeApi } from './testing/fake-api';
import { memoryCopies } from './testing/memory-copies';
import { box, plainTab, tabAnswer } from './testing/tabs';
import { HELD_RETRY_INTERVAL_MS, submitChangeset } from './write';

const TAB = `/documents/${DOC_A}/tabs/tab-one-0000`;
const target = { documentId: DOC_A, tabId: 'tab-one-0000', tabName: 'Overview', doc: 'Auth flow' };
const written = (rebasedOver = 0) => ({
  dryRun: false,
  changeset: { id: 'cs_1', tabId: 'tab-one-0000', rev: 6, previousRev: 5, rebasedOver },
  results: [],
  text: '+ n2  square "B"\nrev 5→6 · cs_1 · lint clean · revert: livediagram changeset revert d cs_1',
  warnings: [],
  lint: null,
});

// Records each changeset request body and answers with `answer`.
function changesetRoute(requests: ChangesetRequest[], answer: () => Response) {
  return async (request: Request) => {
    requests.push(JSON.parse(await request.text()) as ChangesetRequest);
    return answer();
  };
}

describe('read copies', () => {
  it('fingerprint every element for the base', () => {
    const tab = plainTab([box('n1', 'A')]);
    expect(baseFromCopy({ rev: 5, tab })).toEqual({
      rev: 5,
      elements: { n1: elementFingerprint(tab.elements[0]!) },
    });
  });

  it('read the plain tab with the revision its ETag names, or nothing without one', async () => {
    const tab = plainTab([box('n1', 'A')]);
    expect(
      await readPlainTab(contextOf(fakeApi({ [TAB]: tabAnswer(tab, 5) })), DOC_A, 'tab-one-0000'),
    ).toEqual({ rev: 5, tab });
    expect(
      await readPlainTab(contextOf(fakeApi({ [TAB]: { tab } })), DOC_A, 'tab-one-0000'),
    ).toBeNull();
  });

  it('are kept only where a store exists and the read names a revision', async () => {
    const tab = plainTab([]);
    const copies = memoryCopies();
    const logs: string[] = [];
    expect(
      await recordCopy(
        contextOf(fakeApi({ [TAB]: tabAnswer(tab, 5) }), [], logs, { copies }),
        DOC_A,
        'tab-one-0000',
      ),
    ).toEqual({ rev: 5, tab });
    expect(logs).toEqual([`copy recorded ${DOC_A}/tab-one-0000 rev 5`]);
    expect(
      await recordCopy(contextOf(fakeApi({ [TAB]: tabAnswer(tab, 5) })), DOC_A, 'tab-one-0000'),
    ).toBeNull();
    expect(
      await recordCopy(
        contextOf(fakeApi({ [TAB]: { tab } }), [], [], { copies }),
        DOC_A,
        'tab-one-0000',
      ),
    ).toBeNull();
  });
});

describe('submitChangeset', () => {
  it('bases a write on the latest read copy, then keeps a copy of what it wrote', async () => {
    const copies = memoryCopies();
    const read = plainTab([box('n1', 'A')]);
    await copies.record(DOC_A, 'tab-one-0000', { rev: 5, tab: read });
    const requests: ChangesetRequest[] = [];
    const after = plainTab([box('n1', 'A'), box('n2', 'B')]);
    const api = fakeApi({
      [`${TAB}/changesets`]: changesetRoute(requests, () => Response.json(written())),
      [TAB]: tabAnswer(after, 6),
    });
    const ctx = contextOf(api, [], [], { copies });
    const response = await submitChangeset(
      ctx,
      target,
      { operations: 'add square label=B' },
      { summary: 'B', strict: true },
    );
    expect(response.changeset?.rev).toBe(6);
    expect(requests[0]).toEqual({
      operations: 'add square label=B',
      base: baseFromCopy({ rev: 5, tab: read }),
      strict: true,
      summary: 'B',
    });
    expect(await copies.latest(DOC_A, 'tab-one-0000')).toEqual({ rev: 6, tab: after });
  });

  it('bases on the copy at --base, or the bare revision when none is kept; no copy sends no base', async () => {
    const copies = memoryCopies();
    const read = plainTab([box('n1', 'A')]);
    await copies.record(DOC_A, 'tab-one-0000', { rev: 3, tab: read });
    const requests: ChangesetRequest[] = [];
    const api = fakeApi({
      [`${TAB}/changesets?dryRun=1`]: changesetRoute(requests, () =>
        Response.json({ ...written(), dryRun: true, changeset: null, warnings: ['no_base'] }),
      ),
    });
    const ctx = contextOf(api, [], [], { copies });
    await submitChangeset(ctx, target, { operations: 'rm n1' }, { dryRun: true, base: 3 });
    await submitChangeset(ctx, target, { operations: 'rm n1' }, { dryRun: true, base: 4 });
    await submitChangeset(contextOf(api), target, { operations: 'rm n1' }, { dryRun: true });
    expect(requests.map((r) => r.base)).toEqual([
      baseFromCopy({ rev: 3, tab: read }),
      { rev: 4 },
      undefined,
    ]);
    expect(ctx.notices).toEqual(['warning: no_base', 'warning: no_base']);
  });

  it('keeps the older copy after a write that rebased over others', async () => {
    const copies = memoryCopies();
    await copies.record(DOC_A, 'tab-one-0000', { rev: 2, tab: plainTab([]) });
    const api = fakeApi({ [`${TAB}/changesets`]: () => Response.json(written(3)) });
    await submitChangeset(contextOf(api, [], [], { copies }), target, { operations: 'rm n1' }, {});
    expect(await copies.revisions(DOC_A, 'tab-one-0000')).toEqual([2]);
  });

  it('retries while people hold the elements, every interval until --wait-held runs out', async () => {
    let calls = 0;
    const held = () =>
      Response.json(
        { error: 'elements_held', held: [{ id: 'n3', by: { name: 'Ada', color: '#f00' } }] },
        { status: 409 },
      );
    const api = fakeApi({
      [`${TAB}/changesets`]: () => (++calls < 3 ? held() : Response.json(written(1))),
    });
    const logs: string[] = [];
    const ctx = contextOf(api, [], logs);
    await submitChangeset(ctx, target, { operations: 'rm n3' }, { waitHeld: 10 });
    expect(ctx.slept).toEqual([HELD_RETRY_INTERVAL_MS, HELD_RETRY_INTERVAL_MS]);
    expect(logs).toEqual(['held retry 1', 'held retry 2']);
    const always = contextOf(fakeApi({ [`${TAB}/changesets`]: held }));
    const err = await submitChangeset(
      always,
      target,
      { operations: 'rm n3' },
      { waitHeld: 3 },
    ).catch((e: unknown) => e);
    expect(always.slept).toEqual([HELD_RETRY_INTERVAL_MS]);
    expect(err).toBeInstanceOf(VerbRefusal);
    expect(err).toMatchObject({
      status: 409,
      message: '1 element is selected by people:',
      lines: ['n3 (Ada)'],
      hint: 'retry later, or add --wait-held 30',
    });
  });

  it('words a conflict, a stale tab and several held elements with what to do next', async () => {
    const refuse = (status: number, body: unknown) =>
      contextOf(fakeApi({ [`${TAB}/changesets`]: () => Response.json(body, { status }) }));
    const run = (ctx: ReturnType<typeof contextOf>, flags = { base: 4 }) =>
      submitChangeset(ctx, target, { operations: 'rm n1' }, flags).catch((e: unknown) => e);
    const reread = 're-read: livediagram tab view "Auth flow" --tab "Overview"';
    expect(
      await run(
        refuse(409, {
          error: 'changeset_conflict',
          rev: 7,
          conflicts: [{ id: 'n1', reason: 'resolves_differently' }],
        }),
      ),
    ).toMatchObject({
      status: 409,
      message: '1 element changed since rev 4 (now 7):',
      lines: ['n1 (resolves differently)'],
      hint: reread,
    });
    expect(
      await run(
        refuse(409, {
          error: 'changeset_conflict',
          rev: 7,
          conflicts: [
            { id: 'a', reason: 'changed' },
            { id: 'b', reason: 'vanished' },
          ],
        }),
      ),
    ).toMatchObject({
      message: '2 elements changed since rev 4 (now 7):',
    });
    expect(await run(refuse(412, { error: 'stale_tab', rev: 7 }))).toMatchObject({
      status: 412,
      message: '"Overview" changed since rev 4 (now 7)',
      hint: reread,
    });
    expect(
      await run(
        refuse(409, {
          error: 'elements_held',
          held: [
            { id: 'a', by: { name: 'A', color: '' } },
            { id: 'b', by: { name: 'B', color: '' } },
          ],
        }),
      ),
    ).toMatchObject({
      message: '2 elements are selected by people:',
    });
    expect(await run(refuse(409, { error: 'elements_held' }))).toMatchObject({
      message: '0 elements are selected by people:',
    });
    expect(
      await run(refuse(409, { error: 'changeset_conflict' }), {} as { base: number }),
    ).toMatchObject({ message: '0 elements changed since your read:' });
    expect(await run(refuse(422, { error: 'rejected', text: '! 1 parse_error' }))).toMatchObject({
      status: 422,
    });
    expect(
      await run(
        contextOf(
          fakeApi({ [`${TAB}/changesets`]: () => new Response('<html>', { status: 409 }) }),
        ),
      ),
    ).toMatchObject({ status: 409 });
    const nullBody = fakeApi({
      [`${TAB}/changesets`]: () => new Response('null', { status: 409 }),
    });
    expect(await run(contextOf(nullBody))).toMatchObject({ status: 409 });
  });

  it('passes a network failure through untouched', async () => {
    const boom = new TypeError('fetch failed');
    const api = fakeApi({
      [`${TAB}/changesets`]: () => {
        throw boom;
      },
    });
    expect(
      await submitChangeset(contextOf(api), target, { operations: 'rm n1' }, {}).catch(
        (e: unknown) => e,
      ),
    ).toBe(boom);
  });
});
