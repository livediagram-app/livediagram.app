// @vitest-environment jsdom
import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KeyboardEvent } from 'react';
import type { RowDrop } from './useRowReorderDrag';
import { usePageContents, type ContentsPageEdits, type ContentsView } from './usePageContents';
import type { ContentsRowBase } from '../../lib/page-contents';

// docs/specs/007-editor/pages-mode.md "Contents": the hook's own branches, one by one (the shared list
// and both homes are driven whole in components/canvas/PageContents.test.tsx). The row drag is stood in
// for, so a drop is handed straight to the hook as the drag would on release.
const drag = vi.hoisted(() => ({
  onDrop: undefined as ((id: string, drop: RowDrop) => void) | undefined,
  dragClick: false,
}));
vi.mock('./useRowReorderDrag', () => ({
  useRowReorderDrag: (o: { onDrop: (id: string, drop: RowDrop) => void }) => {
    drag.onDrop = o.onDrop;
    return { consumeDragClick: () => drag.dragClick };
  },
}));

type Page = { id: string };
const pagesOf = (n: number): Page[] => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}` }));
const rowOf = (p: Page, i: number, locked = false): ContentsRowBase => ({
  id: p.id,
  number: i + 1,
  name: `Page ${i + 1}`,
  line: 'Slide',
  locked,
  aspect: 1,
});

function editsOf(over: Partial<ContentsPageEdits<[kind: string]>> = {}) {
  return {
    movePage: vi.fn(),
    movePageTo: vi.fn(),
    canMove: () => true,
    addPage: vi.fn(),
    addPageLike: vi.fn(),
    duplicatePage: vi.fn(),
    canDuplicate: () => true,
    removePage: vi.fn(),
    setLocked: vi.fn(),
    ...over,
  };
}

type Opts = {
  pages?: Page[];
  rows?: ContentsRowBase[];
  edit?: ContentsPageEdits<[kind: string]> | undefined;
  lastPage?: Page | undefined;
  maxPages?: number;
  here?: string | undefined;
  extra?: boolean;
  onWent?: () => void;
  dropTo?: number | null;
};

function setup(opts: Opts = {}) {
  const spies = { focusPage: vi.fn(), openSettings: vi.fn(), track: vi.fn() };
  const props = (o: Opts) => {
    const pages = o.pages ?? pagesOf(3);
    const view: ContentsView<Page, [kind: string]> = {
      pages,
      focusPage: spies.focusPage,
      ...('edit' in o ? { edit: o.edit } : { edit: editsOf() }),
    };
    return {
      view,
      rows: o.rows ?? pages.map((p, i) => rowOf(p, i)),
      dropUnit: (_id: string, drop: RowDrop) => ('dropTo' in o ? o.dropTo! : drop.index),
      lastPage: 'lastPage' in o ? o.lastPage : pages.at(-1),
      maxPages: o.maxPages ?? 10,
      openSettings: spies.openSettings,
      ...(o.extra
        ? { extraActions: () => [{ key: 'own', label: 'Own Verb', icon: null, run: () => {} }] }
        : {}),
      track: spies.track,
      here: 'here' in o ? o.here : 'p1',
      onWent: o.onWent,
    };
  };
  const hook = renderHook((o: Opts) => usePageContents(props(o)), { initialProps: opts });
  return { ...hook, spies };
}

// Each row's button, as the list registers it.
function register(
  result: { current: { registerRow: (id: string, el: HTMLElement | null) => void } },
  ids: string[],
) {
  const els = new Map<string, HTMLButtonElement>();
  for (const id of ids) {
    const b = document.createElement('button');
    b.dataset.pageRow = id;
    document.body.append(b);
    els.set(id, b);
    act(() => result.current.registerRow(id, b));
  }
  return els;
}

const key = (k: string) => ({ key: k, preventDefault: vi.fn() }) as unknown as KeyboardEvent;

beforeEach(() => {
  drag.onDrop = undefined;
  drag.dragClick = false;
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('usePageContents', () => {
  it('draws every row’s picture where there is no IntersectionObserver', () => {
    const { result } = setup();
    expect(result.current.drawnIds).toEqual(['p1', 'p2', 'p3']);
    expect(result.current.current).toBe('p1');
  });

  it('draws only the rows scrolled near view, each kept once drawn, and lets go of a row’s old button', () => {
    class FakeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      cb: IntersectionObserverCallback;
      constructor(cb: IntersectionObserverCallback) {
        this.cb = cb;
        observers.push(this);
      }
    }
    const observers: FakeObserver[] = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    const { result, unmount } = setup();
    expect(result.current.drawnIds).toEqual([]);
    const els = register(result, ['p1', 'p2']);
    const io = observers[0]!;
    expect(io.observe).toHaveBeenCalledTimes(2);
    const entry = (id: string, isIntersecting: boolean) =>
      ({
        target: els.get(id) ?? document.createElement('i'),
        isIntersecting,
      }) as unknown as IntersectionObserverEntry;
    // A row off screen, a target with no row, and a row near view: only the last is drawn.
    act(() => io.cb([entry('p2', false), entry('none', true), entry('p1', true)], {} as never));
    expect(result.current.drawnIds).toEqual(['p1']);
    // Seen again, nothing changes; nothing new keeps the same set.
    const before = result.current.drawnIds;
    act(() => io.cb([entry('p1', true)], {} as never));
    expect(result.current.drawnIds).toEqual(before);
    // A row re-registered with a new button lets go of the old one; a row gone is forgotten.
    const fresh = document.createElement('button');
    act(() => result.current.registerRow('p1', fresh));
    expect(io.unobserve).toHaveBeenCalledWith(els.get('p1'));
    act(() => result.current.registerRow('p1', fresh));
    expect(io.unobserve).toHaveBeenCalledTimes(1);
    act(() => result.current.registerRow('p2', null));
    unmount();
    expect(io.disconnect).toHaveBeenCalled();
    // After the observer is gone, a row registered is kept without one.
    act(() => result.current.registerRow('p3', document.createElement('button')));
  });

  it('watches the rows already in the list as the observer starts', () => {
    const observed: Element[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = (el: Element) => observed.push(el);
        unobserve() {}
        disconnect() {}
      },
    );
    const edit = editsOf();
    function List() {
      const c = usePageContents({
        view: { pages: pagesOf(1), focusPage: () => {}, edit },
        rows: [rowOf({ id: 'p1' }, 0)],
        dropUnit: () => null,
        lastPage: undefined,
        maxPages: 10,
        openSettings: () => {},
        track: () => {},
        here: 'p1',
      });
      return <button type="button" data-page-row="p1" ref={(el) => c.registerRow('p1', el)} />;
    }
    render(<List />);
    expect(observed).toEqual([document.querySelector('[data-page-row="p1"]')]);
  });

  it('opens scrolled to the page here, or nowhere with none', () => {
    const { result } = setup({ here: undefined });
    expect(result.current.current).toBeUndefined();
    register(result, ['p1']);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('goes to a pressed row, telling the phone’s sheet, but not on the release of a drag', () => {
    const onWent = vi.fn();
    const { result, spies } = setup({ onWent });
    act(() => result.current.go(result.current.rows[1]!));
    expect(spies.focusPage).toHaveBeenCalledWith('p2');
    expect(spies.track).toHaveBeenCalledWith('PageContentsJump');
    expect(onWent).toHaveBeenCalledOnce();
    expect(result.current.current).toBe('p2');
    drag.dragClick = true;
    act(() => result.current.go(result.current.rows[2]!, 5));
    expect(result.current.current).toBe('p2');
    // With no sheet to close, a press still goes.
    drag.dragClick = false;
    const bare = setup();
    act(() => bare.result.current.go(bare.result.current.rows[2]!));
    expect(bare.result.current.current).toBe('p3');
  });

  it('moves a dropped page where the editor says, and leaves it where the editor says it stays', () => {
    const edit = editsOf();
    const { result, spies } = setup({ edit, dropTo: 2 });
    expect(result.current.reorderable).toBe(true);
    act(() => drag.onDrop!('p1', { index: 2, side: 'after' }));
    expect(edit.movePageTo).toHaveBeenCalledWith('p1', 2);
    expect(spies.track).toHaveBeenCalledWith('PageContentsReorder');
    expect(result.current.current).toBe('p1');
    const stays = setup({ edit: editsOf(), dropTo: null });
    act(() => drag.onDrop!('p2', { index: 0, side: 'before' }));
    expect(stays.spies.track).not.toHaveBeenCalled();
  });

  it('gives a Participant and a Viewer no drag, no actions and no Add Page', () => {
    const { result } = setup({ edit: undefined });
    expect(result.current.reorderable).toBe(false);
    act(() => drag.onDrop!('p1', { index: 2, side: 'after' }));
    expect(result.current.actionsFor(result.current.rows[0]!)).toBeNull();
    expect(result.current.canAdd).toBe(false);
    expect(result.current.add).toBeUndefined();
    expect(result.current.addLike).toBeUndefined();
  });

  it('moves the focus with the arrows, Home and End, from the first row when none has it, and not in an empty list', () => {
    const { result } = setup();
    const els = register(result, ['p1', 'p2', 'p3']);
    act(() => result.current.onListKey(key('ArrowDown')));
    expect(document.activeElement).toBe(els.get('p1'));
    act(() => result.current.onListKey(key('End')));
    expect(document.activeElement).toBe(els.get('p3'));
    act(() => result.current.onListKey(key('ArrowUp')));
    expect(document.activeElement).toBe(els.get('p2'));
    act(() => result.current.onListKey(key('Home')));
    expect(document.activeElement).toBe(els.get('p1'));
    const other = key('Tab');
    act(() => result.current.onListKey(other));
    expect(other.preventDefault).not.toHaveBeenCalled();
    // Focus on no row (the body): the arrows start from the top.
    (document.activeElement as HTMLElement).blur();
    act(() => result.current.onListKey(key('ArrowUp')));
    expect(document.activeElement).toBe(els.get('p1'));
    const empty = setup({ pages: [], rows: [] });
    const end = key('End');
    act(() => empty.result.current.onListKey(end));
    expect(end.preventDefault).not.toHaveBeenCalled();
  });

  it('adds a page, and once it arrives marks it as here wherever it lands', () => {
    const edit = editsOf();
    const pages = pagesOf(3);
    const { result, rerender } = setup({ edit, pages });
    act(() => result.current.add!('slide'));
    expect(edit.addPage).toHaveBeenCalledWith('slide');
    // The new page lands after the first, not last.
    const after = [pages[0]!, { id: 'new' }, pages[1]!, pages[2]!];
    rerender({ edit, pages: after });
    expect(result.current.current).toBe('new');
  });

  it('adds a page like the last right after the page here, and marks the last when no new id shows', () => {
    const edit = editsOf();
    const pages = pagesOf(2);
    const { result, rerender } = setup({ edit, pages, here: undefined });
    act(() => result.current.addLike!());
    // With no page here, after the last.
    expect(edit.addPageLike).toHaveBeenCalledWith('p2', undefined);
    // One more page but no id it did not have before (an id reused): the last row is marked.
    rerender({ edit, pages: [...pages, { id: 'p1' }], here: undefined });
    expect(result.current.current).toBe('p1');
  });

  it('gives way at the page limit, and offers no copy with no last page or no Add Page Like', () => {
    const full = setup({ maxPages: 3 });
    expect(full.result.current.full).toBe(true);
    expect(full.result.current.add).toBeUndefined();
    expect(full.result.current.addLike).toBeUndefined();
    const groupsOf = (r: typeof full.result) =>
      r.current
        .actionsFor(r.current.rows[0]!)!
        .groups.flat()
        .map((a) => a.key);
    expect(groupsOf(full.result)).not.toContain('duplicate');
    const noLast = setup({ lastPage: undefined });
    expect(noLast.result.current.addLike).toBeUndefined();
    expect(noLast.result.current.add).toBeDefined();
    const bare = setup({
      edit: { ...editsOf(), addPage: undefined, addPageLike: undefined },
    });
    expect(bare.result.current.canAdd).toBe(false);
    expect(bare.result.current.add).toBeUndefined();
    expect(bare.result.current.addLike).toBeUndefined();
  });

  it('builds a page’s menu from what it can take, and runs each verb', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    const onWent = vi.fn();
    const edit = editsOf({
      canMove: (id, by) => !(id === 'p1' && by === -1) && !(id === 'p3' && by === 1),
    });
    const pages = pagesOf(3);
    const rows = pages.map((p, i) => rowOf(p, i, i === 1));
    const { result, spies } = setup({ edit, pages, rows, extra: true, onWent });
    const els = register(result, ['p1', 'p2', 'p3']);
    const first = result.current.actionsFor(rows[0]!)!;
    const run = (model: typeof first, k: string) =>
      model.groups
        .flat()
        .find((a) => a.key === k)!
        .run();
    expect(first.groups.flat().map((a) => a.key)).toEqual([
      'settings',
      'own',
      'duplicate',
      'move-down',
      'lock',
    ]);
    run(first, 'settings');
    expect(spies.focusPage).toHaveBeenCalledWith('p1');
    expect(onWent).toHaveBeenCalled();
    frames.shift()!(0);
    expect(spies.openSettings).toHaveBeenCalledWith('p1');
    run(first, 'duplicate');
    expect(edit.duplicatePage).toHaveBeenCalledWith('p1');
    run(first, 'move-down');
    expect(edit.movePage).toHaveBeenCalledWith('p1', 1);
    run(first, 'lock');
    expect(edit.setLocked).toHaveBeenCalledWith('p1', true);
    // Delete, then the focus goes to the row after the first.
    first.remove!();
    expect(edit.removePage).toHaveBeenCalledWith('p1');
    frames.shift()!(0);
    expect(document.activeElement).toBe(els.get('p2'));
    // A locked page unlocks and cannot be deleted; the last moves up only.
    const locked = result.current.actionsFor(rows[1]!)!;
    run(locked, 'lock');
    expect(edit.setLocked).toHaveBeenCalledWith('p2', false);
    expect(locked.remove).toBeUndefined();
    const last = result.current.actionsFor(rows[2]!)!;
    expect(last.groups.flat().map((a) => a.key)).not.toContain('move-down');
    run(last, 'move-up');
    expect(edit.movePage).toHaveBeenCalledWith('p3', -1);
    // Settings with no sheet to close still glides there.
    const bare = setup({ edit: editsOf({ canDuplicate: () => false, duplicatePage: undefined }) });
    const plain = bare.result.current.actionsFor(bare.result.current.rows[0]!)!;
    expect(plain.groups.flat().map((a) => a.key)).not.toContain('duplicate');
    run(plain, 'settings');
    expect(bare.spies.focusPage).toHaveBeenCalledWith('p1');
    const noDelete = setup({ edit: editsOf({ removePage: undefined }) });
    expect(
      noDelete.result.current.actionsFor(noDelete.result.current.rows[0]!)!.remove,
    ).toBeUndefined();
  });
});
