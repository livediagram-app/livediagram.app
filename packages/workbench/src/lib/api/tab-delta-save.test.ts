import { elementsDigest, type TabDeltaOp } from '@liveworkspace/api-schema/tab-delta';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTabDeltaSaves, TAB_DELTA_BASES_MAX } from './tab-delta-save';

// The editor's side of the delta save (livediagram's docs/specs/006-document/delta-saves.md "How the editor uses
// it"). livediagram's own tests (apps/editor/lib/api/tab-delta-save.test.ts) drive it through the editor's binding
// with the real diff; these cover the shared rules with a small one.

type El = { id: string; label?: string };

// Updates and adds only: enough for these cases.
const diff = (before: El[], after: El[]): TabDeltaOp<El>[] => {
  const byId = new Map(before.map((e) => [e.id, JSON.stringify(e)]));
  return after.flatMap((e, at): TabDeltaOp<El>[] => {
    const prev = byId.get(e.id);
    if (prev === undefined) return [{ kind: 'add', element: e, at }];
    return prev === JSON.stringify(e) ? [] : [{ kind: 'update', element: e }];
  });
};

const many = (n: number, label = 'x'): El[] =>
  Array.from({ length: n }, (_, i) => ({ id: `e${i}`, label }));

function setup(max?: number) {
  const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
  const expectOkVoid = vi.fn(async (res: Response, action: string) => {
    if (!res.ok) throw new Error(`${action} ${res.status}`);
  });
  const signal = new AbortController().signal;
  const saveTimeoutSignal = vi.fn((_body: string) => signal);
  const saves = createTabDeltaSaves<El>({ diff, fetch, expectOkVoid, saveTimeoutSignal, max });
  return { saves, fetch, expectOkVoid, saveTimeoutSignal, signal };
}

describe('base copies', () => {
  it('holds a copy per tab, and drops it', () => {
    const { saves } = setup();
    expect(saves.base('d', 't')).toBeNull();
    saves.hold('d', 't', 3, many(1));
    expect(saves.base('d', 't')).toEqual({ rev: 3, elements: many(1) });
    expect(saves.base('d', 'other')).toBeNull();
    saves.drop('d', 't');
    expect(saves.base('d', 't')).toBeNull();
  });

  it('never replaces a copy with one for an older revision', () => {
    const { saves } = setup();
    saves.hold('d', 't', 5, many(1, 'new'));
    saves.hold('d', 't', 4, many(1, 'old'));
    expect(saves.base('d', 't')).toEqual({ rev: 5, elements: many(1, 'new') });
    saves.hold('d', 't', 5, many(1, 'same rev'));
    expect(saves.base('d', 't')?.elements).toEqual(many(1, 'same rev'));
  });

  it('holds at most the bound, the least recently used out first', () => {
    expect(TAB_DELTA_BASES_MAX).toBe(16);
    const { saves } = setup(2);
    saves.hold('d', 'a', 1, []);
    saves.hold('d', 'b', 1, []);
    // A hold refreshes a: b is now the least recently used.
    saves.hold('d', 'a', 2, []);
    saves.hold('d', 'c', 1, []);
    expect(saves.base('d', 'b')).toBeNull();
    expect(saves.base('d', 'a')?.rev).toBe(2);
    expect(saves.base('d', 'c')?.rev).toBe(1);
  });

  it("holds a whole save's echo with the editor's own objects wherever they match", () => {
    const { saves } = setup();
    const sent = many(3);
    // The api stored e1 differently (a merge), and e3 the editor never sent.
    const echoed: El[] = [
      { id: 'e0', label: 'x' },
      { id: 'e1', label: 'merged' },
      { id: 'e2', label: 'x' },
      { id: 'e3' },
    ];
    saves.holdEcho('d', 't', 4, echoed, sent);
    const held = saves.base('d', 't')!;
    expect(held.rev).toBe(4);
    expect(held.elements).toEqual(echoed);
    expect(held.elements[0]).toBe(sent[0]);
    expect(held.elements[1]).toBe(echoed[1]);
    expect(held.elements[2]).toBe(sent[2]);
    expect(held.elements[3]).toBe(echoed[3]);
  });

  it('holds sixteen tabs by default', () => {
    const { saves } = setup();
    for (let i = 0; i <= TAB_DELTA_BASES_MAX; i++) saves.hold('d', `t${i}`, 1, []);
    expect(saves.base('d', 't0')).toBeNull();
    expect(saves.base('d', `t${TAB_DELTA_BASES_MAX}`)).not.toBeNull();
  });
});

describe('send', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  const args = (elements: El[]) => ({
    itemId: 'd',
    tabId: 't',
    url: '/api/documents/d/tabs/t',
    tab: { elements },
    headers: new Headers({ 'X-Changeset-Seen': '4' }),
  });

  it('answers null without a request when no base copy is held', async () => {
    const { saves, fetch } = setup();
    expect(await saves.send(args(many(3)))).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers null without a request when the delta is not worth sending', async () => {
    const { saves, fetch } = setup();
    saves.hold('d', 't', 1, many(3, 'a'));
    expect(await saves.send(args(many(3, 'b')))).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts the delta with the whole save's headers, and holds what it sent when the digest matches", async () => {
    const { saves, fetch, saveTimeoutSignal, signal } = setup();
    saves.hold('d', 't', 1, many(40));
    const next = many(40);
    next[7] = { id: 'e7', label: 'edited' };
    const digest = await elementsDigest(next);
    fetch.mockResolvedValueOnce(Response.json({ rev: 2, digest }));
    expect(await saves.send(args(next))).toEqual({ rev: 2 });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('/api/documents/d/tabs/t/delta');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('X-Changeset-Seen')).toBe('4');
    expect(init.signal).toBe(signal);
    expect(saveTimeoutSignal).toHaveBeenCalledWith(init.body);
    expect(JSON.parse(init.body as string)).toEqual({
      baseRev: 1,
      digest,
      ops: [{ kind: 'update', element: { id: 'e7', label: 'edited' } }],
      tab: {},
    });
    expect(saves.base('d', 't')).toEqual({ rev: 2, elements: next });
  });

  it('drops the base copy when the stored digest is not the one sent', async () => {
    const { saves, fetch } = setup();
    saves.hold('d', 't', 1, many(40));
    fetch.mockResolvedValueOnce(Response.json({ rev: 2, digest: 'f'.repeat(64) }));
    const next = many(40);
    next[0] = { id: 'e0', label: 'edited' };
    expect(await saves.send(args(next))).toEqual({ rev: 2 });
    expect(saves.base('d', 't')).toBeNull();
  });

  it('answers a null revision and drops the base copy when the answer names none', async () => {
    const { saves, fetch } = setup();
    saves.hold('d', 't', 1, many(40));
    fetch.mockResolvedValueOnce(new Response('not json', { status: 200 }));
    const next = many(40);
    next[0] = { id: 'e0', label: 'edited' };
    expect(await saves.send(args(next))).toEqual({ rev: null });
    expect(saves.base('d', 't')).toBeNull();
    saves.hold('d', 't', 1, many(40));
    fetch.mockResolvedValueOnce(Response.json({ rev: 3, digest: 7 }));
    expect(await saves.send(args(next))).toEqual({ rev: 3 });
    expect(saves.base('d', 't')).toBeNull();
    saves.hold('d', 't', 1, many(40));
    fetch.mockResolvedValueOnce(Response.json({ digest: await elementsDigest(next) }));
    expect(await saves.send(args(next))).toEqual({ rev: null });
    expect(saves.base('d', 't')).toBeNull();
  });

  it('keeps a newer base copy held while the request was out', async () => {
    const { saves, fetch } = setup();
    saves.hold('d', 't', 1, many(40));
    const next = many(40);
    next[0] = { id: 'e0', label: 'edited' };
    fetch.mockImplementationOnce(async () => {
      saves.hold('d', 't', 9, many(40));
      return Response.json({ rev: 2, digest: 'f'.repeat(64) });
    });
    await saves.send(args(next));
    expect(saves.base('d', 't')?.rev).toBe(9);
    fetch.mockImplementationOnce(async () => {
      saves.hold('d', 't', 10, many(40));
      return Response.json({ error: 'delta_refused', reason: 'stale_base' }, { status: 409 });
    });
    const again = many(40);
    again[0] = { id: 'e0', label: 'again' };
    expect(await saves.send(args(again))).toBeNull();
    expect(saves.base('d', 't')?.rev).toBe(10);
  });

  it('answers null and drops the base copy on the refusal, naming its reason', async () => {
    const { saves, fetch, expectOkVoid } = setup();
    const next = many(40);
    next[0] = { id: 'e0', label: 'edited' };
    saves.hold('d', 't', 1, many(40));
    fetch.mockResolvedValueOnce(
      Response.json({ error: 'delta_refused', reason: 'stale_base' }, { status: 409 }),
    );
    expect(await saves.send(args(next))).toBeNull();
    expect(saves.base('d', 't')).toBeNull();
    expect(expectOkVoid).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith('[tab-delta] refused', {
      tabId: 't',
      reason: 'stale_base',
    });
    saves.hold('d', 't', 1, many(40));
    fetch.mockResolvedValueOnce(Response.json({ error: 'delta_refused' }, { status: 409 }));
    expect(await saves.send(args(next))).toBeNull();
    expect(console.info).toHaveBeenLastCalledWith('[tab-delta] refused', {
      tabId: 't',
      reason: 'unknown',
    });
  });

  it("surfaces the whole save's own refusals and failures", async () => {
    const { saves, fetch } = setup();
    const next = many(40);
    next[0] = { id: 'e0', label: 'edited' };
    saves.hold('d', 't', 1, many(40));
    fetch.mockResolvedValueOnce(Response.json({ error: 'tab_busy' }, { status: 409 }));
    await expect(saves.send(args(next))).rejects.toThrow('save tab 409');
    fetch.mockResolvedValueOnce(new Response('<html>', { status: 409 }));
    await expect(saves.send(args(next))).rejects.toThrow('save tab 409');
    fetch.mockResolvedValueOnce(Response.json({ error: 'forbidden' }, { status: 403 }));
    await expect(saves.send(args(next))).rejects.toThrow('save tab 403');
    // A failed save leaves the base copy: the next delta finds out whether it landed (stale_base).
    expect(saves.base('d', 't')?.rev).toBe(1);
  });
});

describe('planUnload', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  const args = (elements: El[]) => ({
    itemId: 'd',
    tabId: 't',
    url: '/api/documents/d/tabs/t',
    tab: { elements },
  });
  const edited = () => many(20).map((e, i) => (i === 2 ? { ...e, label: 'new' } : e));

  it('answers null with no base copy, or a delta not worth sending', () => {
    const { saves } = setup();
    expect(saves.planUnload(args(many(20)))).toBeNull();
    saves.hold('d', 't', 1, many(2));
    expect(saves.planUnload(args(many(2, 'changed')))).toBeNull();
  });

  it('plans the delta at once, with the digest the api checks, and sends nothing itself', async () => {
    const { saves, fetch } = setup();
    saves.hold('d', 't', 3, many(20));
    const plan = saves.planUnload(args(edited()))!;
    expect(plan.url).toBe('/api/documents/d/tabs/t/delta');
    const body = JSON.parse(plan.body) as { baseRev: number; digest: string; ops: unknown[] };
    expect(body.baseRev).toBe(3);
    expect(body.ops).toEqual([{ kind: 'update', element: { id: 'e2', label: 'new' } }]);
    expect(body.digest).toBe(await elementsDigest(edited()));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('a landed delta with a matching digest is the next base copy', async () => {
    const { saves } = setup();
    saves.hold('d', 't', 3, many(20));
    const elements = edited();
    const plan = saves.planUnload(args(elements))!;
    const digest = await elementsDigest(elements);
    expect(await plan.settle(Response.json({ rev: 4, digest }))).toBe('saved');
    expect(saves.base('d', 't')).toEqual({ rev: 4, elements });
  });

  it('a refusal drops the base copy and says to send the tab whole', async () => {
    const { saves } = setup();
    saves.hold('d', 't', 3, many(20));
    const plan = saves.planUnload(args(edited()))!;
    const refused = Response.json(
      { error: 'delta_refused', reason: 'stale_base' },
      { status: 409 },
    );
    expect(await plan.settle(refused)).toBe('refused');
    expect(saves.base('d', 't')).toBeNull();
  });

  it("another failure is 'failed', quietly, and keeps the base copy", async () => {
    const { saves, expectOkVoid } = setup();
    saves.hold('d', 't', 3, many(20));
    const plan = saves.planUnload(args(edited()))!;
    const busy = Response.json({ error: 'tab_busy' }, { status: 409 });
    expect(await plan.settle(busy)).toBe('failed');
    expect(expectOkVoid).not.toHaveBeenCalled();
    expect(saves.base('d', 't')?.rev).toBe(3);
  });
});
