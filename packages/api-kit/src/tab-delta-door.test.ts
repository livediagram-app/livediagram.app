import { afterEach, describe, expect, it, vi } from 'vitest';
import { TAB_DELTA_MAX_OPS, elementsDigest } from '@liveworkspace/api-schema/tab-delta';
import { answerTabDelta, type TabDeltaDoor } from './tab-delta-door';

// The shared delta door (each product's docs/specs/006-*/delta-saves.md "How the api applies it"): every refusal
// writes nothing, and only a rebuild its digest proves reaches the product's whole save.

type El = { id: string; label: string };
const el = (id: string, label = id): El => ({ id, label });

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json' } });
const badRequest = (message: string) => json({ error: 'bad_request', message }, { status: 400 });

// Applies updates by id, the one op these tests send.
const apply = (elements: El[], ops: { kind: string; element?: El }[]) =>
  elements.map((e) => ops.find((op) => op.element?.id === e.id)?.element ?? e);

function door(
  body: unknown,
  over: Partial<TabDeltaDoor<El, { rev: number; elements: El[] }>> = {},
) {
  const write = vi.fn(async (tab: Record<string, unknown>) => ({
    rev: 3,
    elements: tab.elements as El[],
  }));
  return {
    write,
    run: () =>
      answerTabDelta<El, { rev: number; elements: El[] }>({
        body,
        idKey: 'projectId',
        itemId: 'P',
        tabId: 't1',
        readStored: async () => ({ rev: 2, elements: [el('a')] }),
        apply,
        write,
        badRequest,
        json,
        ...over,
      }),
  };
}

async function bodyFor(next: El[], baseRev = 2) {
  return {
    baseRev,
    digest: await elementsDigest(next),
    ops: next.map((element) => ({ kind: 'update', element })),
    tab: { name: 'Board', elements: ['dropped'] },
  };
}

const answer = async (res: Response) => ({ status: res.status, body: await res.json() });

afterEach(() => vi.restoreAllMocks());

describe('answerTabDelta', () => {
  it('saves a proved rebuild through the whole save, answering its revision and digest', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const next = [el('a', 'edited')];
    const { run, write } = door(await bodyFor(next));
    expect(await answer(await run())).toEqual({
      status: 200,
      body: { rev: 3, digest: await elementsDigest(next) },
    });
    expect(write).toHaveBeenCalledWith(
      { name: 'Board', id: 't1', elements: next },
      { rev: 2, elements: [el('a')] },
    );
    expect(info).toHaveBeenCalledWith('[tab-delta] saved', {
      projectId: 'P',
      tabId: 't1',
      ops: 1,
      matched: true,
    });
  });

  it('answers the digest of what was stored when the save merged something in', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const merged = [el('a', 'merged')];
    const { run } = door(await bodyFor([el('a', 'edited')]), {
      write: async () => ({ rev: 3, elements: merged }),
    });
    expect(await run().then((r) => r.json())).toEqual({
      rev: 3,
      digest: await elementsDigest(merged),
    });
    expect(info).toHaveBeenCalledWith(
      '[tab-delta] saved',
      expect.objectContaining({ matched: false }),
    );
  });

  it("passes the whole save's own refusal through", async () => {
    const refused = json({ error: 'empty_tab_overwrite_blocked' }, { status: 409 });
    const { run } = door(await bodyFor([el('a', 'x')]), { write: async () => refused });
    expect(await run()).toBe(refused);
  });

  it('answers a malformed body 400 and writes nothing', async () => {
    const { run, write } = door({ baseRev: -1 });
    expect(await answer(await run())).toEqual({
      status: 400,
      body: { error: 'bad_request', message: 'invalid baseRev' },
    });
    expect(write).not.toHaveBeenCalled();
  });

  it.each([
    [
      'too_many_ops',
      async () => ({
        ...(await bodyFor([el('a')])),
        ops: Array.from({ length: TAB_DELTA_MAX_OPS + 1 }, (_, i) => ({
          kind: 'remove',
          id: `x${i}`,
        })),
      }),
      {},
    ],
    ['no_base', async () => bodyFor([el('a', 'x')]), { readStored: async () => null }],
    ['stale_base', async () => bodyFor([el('a', 'x')], 1), {}],
    [
      'digest_mismatch',
      async () => ({ ...(await bodyFor([el('a', 'x')])), digest: 'f'.repeat(64) }),
      {},
    ],
  ] as const)('refuses %s, writing nothing', async (reason, make, over) => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { run, write } = door(await make(), over);
    expect(await answer(await run())).toEqual({
      status: 409,
      body: { error: 'delta_refused', reason },
    });
    expect(write).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith('[tab-delta] refused', {
      projectId: 'P',
      tabId: 't1',
      reason,
    });
  });
});
