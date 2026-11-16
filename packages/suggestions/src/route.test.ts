import { describe, expect, it, vi } from 'vitest';
import {
  answerSuggestions,
  type AcceptDecide,
  type SuggestionDoor,
  type SuggestionLevel,
} from './route';
import { suggestionStore } from './store';
import { mintSuggestionId, SUGGESTIONS_MAX_PER_TAB, type CanvasSuggestion } from './suggestion';
import { fakeSuggestionDb } from './test/fake-db';
import { applyOps, author, el, model, parseEl, type El } from './test/fixtures';

function door(level: SuggestionLevel, over: Partial<SuggestionDoor<El>> = {}) {
  const { db, rows } = fakeSuggestionDb();
  let canvas: El[] | null = [el('a'), el('b')];
  const written: El[][] = [];
  const changed = vi.fn(async () => {});
  const log = vi.fn();
  let n = 0;
  const d: SuggestionDoor<El> = {
    level,
    author,
    tabId: 't1',
    store: suggestionStore<El>(db),
    model,
    parseElement: parseEl,
    readElements: async () => canvas,
    isValid: (els) => els.every((e) => e.id !== 'bad'),
    writeAccepted: async (decide: AcceptDecide<El>) => {
      const plan = decide(canvas!);
      if (!plan) return { ok: true, changesetId: null };
      canvas = plan.elements;
      written.push(plan.elements);
      return { ok: true, changesetId: 'cs_1' };
    },
    changed,
    now: () => 1000 + n,
    mintId: () => {
      n += 1;
      return mintSuggestionId(() => new Uint8Array(10).fill(n));
    },
    log,
    ...over,
  };
  return {
    d,
    rows,
    written,
    changed,
    log,
    canvas: () => canvas,
    setCanvas: (c: El[] | null) => {
      canvas = c;
    },
    with: (o: Partial<SuggestionDoor<El>>) => Object.assign(d, o),
  };
}

const submit = (d: SuggestionDoor<El>, ops: unknown) => answerSuggestions('submit', { ops }, d);
const made = (r: { body: unknown }) => (r.body as { suggestion: CanvasSuggestion<El> }).suggestion;

describe('answerSuggestions: roles', () => {
  it('refuses a Viewer every action', async () => {
    const t = door('view');
    for (const action of ['list', 'submit', 'accept', 'reject'] as const) {
      const r = await answerSuggestions(action, { all: true }, t.d);
      expect(r.status).toBe(403);
      expect((r.body as { error: string }).error).toBe('viewer_cannot_suggest');
    }
  });

  it('lets a Participant suggest and list, never accept', async () => {
    const t = door('participate');
    const r = await submit(t.d, [{ kind: 'update', element: el('a', 5) }]);
    expect(r.status).toBe(201);
    expect(t.changed).toHaveBeenCalledTimes(1);
    expect(t.log).toHaveBeenCalledWith('[suggestion] made', { tabId: 't1', ops: 1 });
    const list = await answerSuggestions('list', null, t.d);
    expect((list.body as { suggestions: unknown[] }).suggestions).toHaveLength(1);
    const accept = await answerSuggestions('accept', { all: true }, t.d);
    expect(accept).toEqual({
      status: 403,
      body: { error: 'editor_only', message: 'only an Editor accepts or rejects' },
    });
    expect(t.canvas()).toEqual([el('a'), el('b')]);
  });

  it('lets a Participant take back only its own', async () => {
    const t = door('participate');
    const mine = made(await submit(t.d, [{ kind: 'remove', id: 'a' }]));
    t.with({ author: { ...author, key: 'k_bo' } });
    const theirs = made(await submit(t.d, [{ kind: 'remove', id: 'b' }]));
    expect((await answerSuggestions('reject', { ids: [mine.id] }, t.d)).status).toBe(403);
    expect(await answerSuggestions('reject', { ids: [theirs.id] }, t.d)).toEqual({
      status: 200,
      body: { rejected: [theirs.id] },
    });
    t.with({ author: null });
    expect((await answerSuggestions('reject', { ids: [mine.id] }, t.d)).status).toBe(403);
  });
});

describe('answerSuggestions: submit', () => {
  it('records the base each target was found at', async () => {
    const t = door('edit');
    const s = made(
      await submit(t.d, [
        { kind: 'add', element: el('c'), at: 0 },
        { kind: 'remove', id: 'a' },
      ]),
    );
    expect(s.base).toEqual({ c: null, a: model.fingerprint(el('a')) });
    expect(s.author).toEqual(author);
    expect(s.createdAt).toBe(1001);
  });

  it('refuses each bad submission by name', async () => {
    const t = door('edit');
    const err = async (ops: unknown) => (await submit(t.d, ops)).body as { error: string };
    expect((await err([])).error).toBe('no_ops');
    expect((await err([{ kind: 'update', element: el('zz') }])).error).toBe('missing_target');
    expect((await err([{ kind: 'add', element: el('a'), at: 0 }])).error).toBe('id_taken');
    expect((await err([{ kind: 'add', element: el('bad'), at: 0 }])).error).toBe('invalid_change');
    expect((await answerSuggestions('submit', null, t.d)).status).toBe(400);
    t.setCanvas(null);
    expect((await err([{ kind: 'remove', id: 'a' }])).error).toBe('not_found');
    t.with({ author: null });
    expect((await err([{ kind: 'remove', id: 'a' }])).error).toBe('no_collab_key');
  });

  it('refuses a flood and an oversized one', async () => {
    const t = door('edit');
    for (let i = 0; i < SUGGESTIONS_MAX_PER_TAB; i += 1) {
      const id = mintSuggestionId(() => Uint8Array.from([i % 32, i >> 5, 1, 1, 1, 1, 1, 1, 1, 1]));
      t.rows.set(id, {
        id,
        tab_id: 't1',
        created_at: i,
        body: JSON.stringify({
          id,
          tabId: 't1',
          author,
          createdAt: i,
          ops: [{ kind: 'remove', id: 'a' }],
        }),
      });
    }
    expect((await submit(t.d, [{ kind: 'remove', id: 'a' }])).status).toBe(409);
    const u = door('edit');
    const huge = el('a', 0, { text: 'x'.repeat(200 * 1024) });
    expect((await submit(u.d, [{ kind: 'update', element: huge }])).status).toBe(413);
  });
});

describe('answerSuggestions: accept and reject', () => {
  it('accepts all as one changeset and clears them', async () => {
    const t = door('edit');
    await submit(t.d, [{ kind: 'update', element: el('a', 5) }]);
    await submit(t.d, [{ kind: 'add', element: el('c'), at: 2 }]);
    const r = await answerSuggestions('accept', { all: true }, t.d);
    expect(r.status).toBe(200);
    expect((r.body as { changeset: string }).changeset).toBe('cs_1');
    expect(t.written).toHaveLength(1);
    expect(t.canvas()).toEqual([el('a', 5), el('b'), el('c')]);
    expect(t.rows.size).toBe(0);
  });

  it('accepts one named suggestion, saying so in the singular', async () => {
    const t = door('edit');
    const s = made(await submit(t.d, [{ kind: 'remove', id: 'b' }]));
    await submit(t.d, [{ kind: 'remove', id: 'a' }]);
    let summary = '';
    t.with({
      writeAccepted: async (decide) => {
        summary = decide(t.canvas()!)!.summary;
        return { ok: true, changesetId: 'cs_2' };
      },
    });
    await answerSuggestions('accept', { ids: [s.id] }, t.d);
    expect(summary).toBe('Accepted a suggestion');
    expect(t.rows.size).toBe(1);
  });

  it('flags a stale suggestion as a conflict, never applying it', async () => {
    const t = door('edit');
    const stale = made(await submit(t.d, [{ kind: 'update', element: el('a', 5) }]));
    const fresh = made(await submit(t.d, [{ kind: 'remove', id: 'b' }]));
    t.setCanvas(applyOps(t.canvas()!, [{ kind: 'update', element: el('a', 9) }]));
    const both = await answerSuggestions('accept', { all: true }, t.d);
    expect(both.body).toEqual({
      accepted: [fresh.id],
      conflicts: [{ id: stale.id, elements: ['a'] }],
      changeset: 'cs_1',
    });
    expect(t.canvas()).toEqual([el('a', 9)]);
    const left = await answerSuggestions('list', null, t.d);
    expect((left.body as { suggestions: CanvasSuggestion<El>[] }).suggestions[0]!.conflict).toEqual(
      ['a'],
    );
    const again = await answerSuggestions('accept', { ids: [stale.id] }, t.d);
    expect(again.status).toBe(409);
    expect((again.body as { error: string }).error).toBe('suggestion_conflict');
    expect(t.canvas()).toEqual([el('a', 9)]);
  });

  it('passes a refused write through', async () => {
    const t = door('edit');
    await submit(t.d, [{ kind: 'remove', id: 'a' }]);
    t.with({ writeAccepted: async () => ({ ok: false, status: 409, body: { error: 'stale' } }) });
    expect(await answerSuggestions('accept', { all: true }, t.d)).toEqual({
      status: 409,
      body: { error: 'stale' },
    });
    expect(t.rows.size).toBe(1);
  });

  it('rejects all, and refuses a bad decision or nothing to decide', async () => {
    const t = door('edit');
    await submit(t.d, [{ kind: 'remove', id: 'a' }]);
    expect((await answerSuggestions('reject', { all: true }, t.d)).status).toBe(200);
    expect(t.rows.size).toBe(0);
    expect((await answerSuggestions('reject', { all: true }, t.d)).status).toBe(404);
    expect((await answerSuggestions('accept', { nope: 1 }, t.d)).status).toBe(400);
  });
});
