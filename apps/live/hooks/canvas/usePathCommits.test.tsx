// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPath, pathAnchors, type Element, type PathAnchor } from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { usePathCommits } from './usePathCommits';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const corner = (x: number, y: number): PathAnchor => ({ x, y, mode: 'corner' });

beforeEach(() => vi.spyOn(console, 'info').mockImplementation(() => {}));
afterEach(() => {
  vi.mocked(track).mockClear();
  vi.restoreAllMocks();
});

function setup(initial: Element[] = [], editsBlocked = false) {
  let els = initial;
  const commit = vi.fn((map: (e: Element[]) => Element[]) => {
    els = map(els);
  });
  const dress = <T extends Element>(el: T): T => ({ ...el, strokeWidth: 'thick' });
  const setSelectedId = vi.fn();
  const { result } = renderHook(() =>
    usePathCommits({ editsBlocked, commit, styleNewElement: dress, setSelectedId }),
  );
  return { api: result.current, commit, els: () => els, setSelectedId };
}

describe('usePathCommits', () => {
  it('lands a drawn path in one commit, dressed by style memory, and reports it', () => {
    const s = setup();
    s.api.commitPath({ anchors: [corner(0, 0), corner(10, 10)], closed: false, continuing: null });
    expect(s.commit).toHaveBeenCalledTimes(1);
    expect(s.els()).toHaveLength(1);
    // Written in Ink by name, unfilled, as Draw mode writes what it makes
    // (docs/specs/007-editor/editor-modes.md "One look").
    expect(s.els()[0]).toMatchObject({
      type: 'path',
      closed: false,
      strokeWidth: 'thick',
      penColour: 'ink',
      fillColor: 'transparent',
    });
    expect(track).toHaveBeenCalledWith('Element', 'Added', 'Path');
    // Selected, so it can be edited at once (Edit points, Enter).
    expect(s.setSelectedId).toHaveBeenCalledWith(s.els()[0]!.id);
  });

  it('refuses a path that is not whole, and anything while edits are blocked', () => {
    const s = setup();
    s.api.commitPath({ anchors: [corner(0, 0), corner(1, 1)], closed: true, continuing: null });
    expect(s.commit).not.toHaveBeenCalled();
    const blocked = setup([], true);
    blocked.api.commitPath({
      anchors: [corner(0, 0), corner(1, 1)],
      closed: false,
      continuing: null,
    });
    expect(blocked.commit).not.toHaveBeenCalled();
  });

  it('replaces a continued path in place, keeping its style', () => {
    const open = { ...createPath([corner(0, 0), corner(10, 0)], false), strokeColor: '#f00' };
    const s = setup([open]);
    s.api.commitPath({
      anchors: [corner(0, 0), corner(10, 0), corner(10, 10)],
      closed: true,
      continuing: { id: open.id },
    });
    expect(s.els()).toHaveLength(1);
    expect(s.els()[0]).toMatchObject({ id: open.id, closed: true, strokeColor: '#f00' });
    expect((s.els()[0] as typeof open).nodes).toHaveLength(3);
    expect(s.setSelectedId).toHaveBeenCalledWith(open.id);
  });

  it('lands a continuation as a new path when the original has gone', () => {
    const s = setup();
    s.api.commitPath({
      anchors: [corner(0, 0), corner(10, 0)],
      closed: false,
      continuing: { id: 'gone' },
    });
    expect(s.els()).toHaveLength(1);
    expect(s.els()[0]!.id).not.toBe('gone');
  });

  it('reshapes an edited path in one commit, and deletes one left too short', () => {
    const tri = createPath([corner(0, 0), corner(10, 0), corner(10, 10)], true);
    const s = setup([tri]);
    const moved = pathAnchors(tri).map((a, i) => (i === 2 ? { ...a, x: 30 } : a));
    s.api.commitPathEdit(tri.id, { anchors: moved, closed: true }, 'edit');
    expect(s.els()[0]).toMatchObject({ id: tri.id, width: 30 });
    expect(track).toHaveBeenLastCalledWith('Element', 'Changed', 'PathEdit');
    s.api.commitPathEdit(tri.id, { anchors: moved.slice(0, 2), closed: true }, 'edit');
    expect(s.els()).toHaveLength(0);
  });

  it('reports a join as its own change', () => {
    const open = createPath([corner(0, 0), corner(10, 0), corner(10, 10)], false);
    const s = setup([open]);
    s.api.commitPathEdit(open.id, { anchors: pathAnchors(open), closed: true }, 'join');
    expect(s.els()[0]).toMatchObject({ closed: true });
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'PathJoin');
  });
});
