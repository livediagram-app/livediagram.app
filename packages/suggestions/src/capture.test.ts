import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSuggestCapture } from './capture';
import { SUGGEST_GATHER_MS, type SuggestionOp } from './suggestion';
import { el, type El } from './test/fixtures';

type Tab = { id: string; name: string; elements: El[] };

function setup(opts: { suggesting?: string | null; pointer?: boolean } = {}) {
  let tabs: Tab[] = [
    { id: 't1', name: 'One', elements: [el('a'), el('b')] },
    { id: 't2', name: 'Two', elements: [el('z')] },
  ];
  let suggesting: string | null = opts.suggesting === undefined ? 't1' : opts.suggesting;
  let pointer = opts.pointer ?? false;
  const proposed: [string, SuggestionOp<El>[]][] = [];
  const refuse = vi.fn();
  const capture = createSuggestCapture<Tab, El>({
    suggestingOn: () => suggesting,
    tabs: () => tabs,
    propose: (tabId, ops) => proposed.push([tabId, ops]),
    refuse,
    pointerDown: () => pointer,
  });
  const apply = vi.fn((map: (t: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  const commit = capture.wrap(apply);
  const onTab =
    (id: string, f: (els: El[]) => El[]) =>
    (ts: Tab[]): Tab[] =>
      ts.map((t) => (t.id === id ? { ...t, elements: f(t.elements) } : t));
  return {
    capture,
    commit,
    apply,
    refuse,
    proposed,
    onTab,
    tabs: () => tabs,
    setSuggesting: (v: string | null) => {
      suggesting = v;
    },
    setPointer: (v: boolean) => {
      pointer = v;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('createSuggestCapture', () => {
  it('passes a change straight through while not suggesting', () => {
    const s = setup({ suggesting: null });
    s.commit(s.onTab('t1', (els) => [...els, el('c')]));
    expect(s.apply).toHaveBeenCalledTimes(1);
    expect(s.tabs()[0]!.elements).toHaveLength(3);
  });

  it('gathers a burst into one suggestion, sent after the gather window', () => {
    vi.useFakeTimers();
    const s = setup();
    const listener = vi.fn();
    const off = s.capture.subscribe(listener);
    s.commit(s.onTab('t1', (els) => els.map((e) => (e.id === 'a' ? el('a', 1) : e))));
    s.commit(s.onTab('t1', (els) => els.map((e) => (e.id === 'a' ? el('a', 2) : e))));
    expect(s.apply).not.toHaveBeenCalled();
    expect(s.capture.draft()?.after[0]).toEqual(el('a', 2));
    expect(s.capture.draft()?.before[0]).toEqual(el('a'));
    vi.advanceTimersByTime(SUGGEST_GATHER_MS);
    expect(s.proposed).toEqual([['t1', [{ kind: 'update', element: el('a', 2) }]]]);
    expect(s.capture.draft()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(3);
    off();
  });

  it('waits for a held pointer before sending', () => {
    vi.useFakeTimers();
    const s = setup({ pointer: true });
    s.commit(s.onTab('t1', (els) => els.filter((e) => e.id !== 'b')));
    vi.advanceTimersByTime(SUGGEST_GATHER_MS * 3);
    expect(s.proposed).toEqual([]);
    s.setPointer(false);
    s.capture.flush();
    expect(s.proposed).toEqual([['t1', [{ kind: 'remove', id: 'b' }]]]);
    s.capture.flush();
    expect(s.proposed).toHaveLength(1);
  });

  it('sends a draft that ends where it began as nothing', () => {
    vi.useFakeTimers();
    const s = setup();
    s.commit(s.onTab('t1', (els) => els.map((e) => (e.id === 'a' ? el('a', 1) : e))));
    s.commit(s.onTab('t1', (els) => els.map((e) => (e.id === 'a' ? el('a') : e))));
    s.capture.flush();
    expect(s.proposed).toEqual([]);
  });

  it('sends what was gathered on one tab when the next change lands on another', () => {
    vi.useFakeTimers();
    const s = setup();
    s.commit(s.onTab('t1', (els) => [...els, el('c')]));
    s.setSuggesting('t2');
    s.commit(s.onTab('t2', () => []));
    expect(s.proposed).toEqual([['t1', [{ kind: 'add', element: el('c'), at: 2 }]]]);
    vi.advanceTimersByTime(SUGGEST_GATHER_MS);
    expect(s.proposed[1]).toEqual(['t2', [{ kind: 'remove', id: 'z' }]]);
  });

  it('refuses a change to another tab, to the tab set, or to the tab settings', () => {
    const s = setup();
    s.commit(s.onTab('t2', () => []));
    s.commit((ts) => ts.slice(0, 1));
    s.commit((ts) => ts.map((t) => (t.id === 't1' ? { ...t, name: 'Renamed' } : t)));
    s.commit((ts) => ts.filter((t) => t.id !== 't1'));
    expect(s.refuse).toHaveBeenCalledTimes(4);
    expect(s.proposed).toEqual([]);
  });

  it('ignores a no-op and refuses a tab the session is not on', () => {
    const s = setup();
    s.commit((ts) => ts);
    s.commit((ts) => ts.map((t) => (t.id === 't1' ? { ...t } : t)));
    expect(s.refuse).not.toHaveBeenCalled();
    s.setSuggesting('gone');
    s.commit((ts) => ts);
    expect(s.refuse).toHaveBeenCalledTimes(1);
  });

  it('lets a change to live fields alone land, and gathers anything more', () => {
    let tabs = [{ id: 't1', elements: [el('a'), el('b')] }];
    const applied: unknown[] = [];
    const capture = createSuggestCapture<{ id: string; elements: El[] }, El>({
      suggestingOn: () => 't1',
      tabs: () => tabs,
      propose: () => {},
      refuse: () => {},
      // `text` stands in for a live field (a comment thread).
      fingerprint: (e) => JSON.stringify({ ...e, text: undefined }),
    });
    const commit = capture.wrap((m) => {
      tabs = m(tabs);
      applied.push(tabs);
    });
    commit((ts) =>
      ts.map((t) => ({ ...t, elements: t.elements.map((e) => ({ ...e, text: 'hi' })) })),
    );
    expect(applied).toHaveLength(1);
    expect(capture.draft()).toBeNull();
    commit((ts) => ts.map((t) => ({ ...t, elements: [...t.elements].reverse() })));
    expect(applied).toHaveLength(1);
    commit((ts) => ts.map((t) => ({ ...t, elements: [el('a', 4)] })));
    expect(applied).toHaveLength(1);
    expect(capture.draft()?.after).toEqual([el('a', 4)]);
    capture.flush();
  });

  it('uses its own timer when none is handed in', () => {
    vi.useFakeTimers();
    const proposed: unknown[] = [];
    let tabs = [{ id: 't1', elements: [el('a')] }];
    const capture = createSuggestCapture({
      suggestingOn: () => 't1',
      tabs: () => tabs,
      propose: (_t, ops) => proposed.push(ops),
      refuse: () => {},
    });
    capture.wrap((m) => {
      tabs = m(tabs);
    })((ts) => ts.map((t) => ({ ...t, elements: [] })));
    vi.advanceTimersByTime(SUGGEST_GATHER_MS);
    expect(proposed).toEqual([[{ kind: 'remove', id: 'a' }]]);
  });
});
