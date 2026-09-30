// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createPath, type Element } from '@livediagram/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { usePathDrawGesture, type PathCommit } from './usePathDrawGesture';

// The Path tool's drawing gesture (docs/specs/023-whiteboard/path-tool.md "Drawing").

const PATH: PendingDraw = { type: 'path' };

function pointer(
  type: string,
  x: number,
  y: number,
  mods: { alt?: boolean; shift?: boolean; ctrl?: boolean } = {},
) {
  return new MouseEvent(type, {
    clientX: x,
    clientY: y,
    altKey: mods.alt,
    shiftKey: mods.shift,
    ctrlKey: mods.ctrl,
  });
}

let clock = 0;
beforeEach(() => {
  clock = 1_000;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function setup(elements: Element[] = [], zoom = 1) {
  const wrapper = document.createElement('div');
  // Canvas px = client px at zoom 1: the wrapper sits at the origin.
  wrapper.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect;
  const commits: PathCommit[] = [];
  const onStartPath = vi.fn();
  const hook = renderHook(
    (p: { pendingDraw: PendingDraw | null; tab: string }) =>
      usePathDrawGesture({
        pendingDraw: p.pendingDraw,
        elements,
        wrapperRef: { current: wrapper },
        viewportZoom: zoom,
        activeTabId: p.tab,
        onCommitPath: (c) => commits.push(c),
        onStartPath,
      }),
    { initialProps: { pendingDraw: PATH as PendingDraw | null, tab: 't' } },
  );
  const press = (
    x: number,
    y: number,
    mods: { shift?: boolean; alt?: boolean; ctrl?: boolean } = {},
  ) => {
    let claimed = false;
    act(() => {
      claimed = hook.result.current.beginPathPress({
        button: 0,
        clientX: x,
        clientY: y,
        shiftKey: !!mods.shift,
        altKey: !!mods.alt,
        ctrlKey: !!mods.ctrl,
        metaKey: false,
      } as ReactPointerEvent);
    });
    return claimed;
  };
  const move = (
    x: number,
    y: number,
    mods: { alt?: boolean; shift?: boolean; ctrl?: boolean } = {},
  ) =>
    act(() => {
      window.dispatchEvent(pointer('pointermove', x, y, mods));
    });
  const up = () =>
    act(() => {
      window.dispatchEvent(pointer('pointerup', 0, 0));
    });
  const click = (x: number, y: number) => {
    press(x, y);
    up();
    clock += 1_000;
  };
  const key = (k: string, type: 'keydown' | 'keyup' = 'keydown') => {
    const e = new KeyboardEvent(type, {
      key: k,
      code: k === ' ' ? 'Space' : k,
      ctrlKey: k === 'Control' && type === 'keydown',
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(e);
    });
    return e;
  };
  // A modified key as the browser sends it: Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, Cmd+Z.
  const chord = (k: string, mods: { shift?: boolean; meta?: boolean } = {}) => {
    const e = new KeyboardEvent('keydown', {
      key: k,
      ctrlKey: !mods.meta,
      metaKey: !!mods.meta,
      shiftKey: !!mods.shift,
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(e);
    });
    return e;
  };
  return { hook, commits, onStartPath, press, move, up, click, key, chord };
}

describe('usePathDrawGesture', () => {
  it('places corner nodes with clicks and lands an open path on Enter, the tool still in hand', () => {
    const s = setup();
    s.click(0, 0);
    s.click(100, 0);
    s.click(100, 80);
    expect(s.hook.result.current.draft!.anchors).toHaveLength(3);
    const enter = s.key('Enter');
    expect(enter.defaultPrevented).toBe(true);
    expect(s.commits).toEqual([
      {
        anchors: [
          { x: 0, y: 0, mode: 'corner' },
          { x: 100, y: 0, mode: 'corner' },
          { x: 100, y: 80, mode: 'corner' },
        ],
        closed: false,
        continuing: null,
      },
    ]);
    expect(s.hook.result.current.draft).toBeNull();
    // The next click starts a new path.
    s.click(10, 10);
    expect(s.hook.result.current.draft!.anchors).toHaveLength(1);
  });

  it('pulls out a mirrored pair with a drag, and breaks it with Alt', () => {
    const s = setup();
    s.click(0, 0);
    s.press(100, 0);
    s.move(101, 0); // under the drag threshold: still a click
    expect(s.hook.result.current.draft!.anchors[1]!.handleOut).toBeUndefined();
    s.move(140, 0);
    expect(s.hook.result.current.draft!.anchors[1]).toEqual({
      x: 100,
      y: 0,
      mode: 'mirrored',
      handleOut: { x: 140, y: 0 },
      handleIn: { x: 60, y: 0 },
    });
    s.move(100, 40, { alt: true });
    expect(s.hook.result.current.draft!.anchors[1]).toMatchObject({
      mode: 'corner',
      handleIn: { x: 60, y: 0 },
      handleOut: { x: 100, y: 40 },
    });
    s.up();
  });

  it('moves the node being placed while Space is held', () => {
    const s = setup();
    s.click(0, 0);
    s.press(100, 0);
    s.move(140, 0);
    const space = s.key(' ');
    expect(space.defaultPrevented).toBe(true);
    s.move(150, 10);
    expect(s.hook.result.current.draft!.anchors[1]).toMatchObject({
      x: 110,
      y: 10,
      handleOut: { x: 150, y: 10 },
    });
    s.key(' ', 'keyup');
    s.move(160, 10);
    expect(s.hook.result.current.draft!.anchors[1]!.handleOut).toEqual({ x: 160, y: 10 });
  });

  it('closes on a click on the first node once there are three', () => {
    const s = setup();
    s.click(0, 0);
    s.click(100, 0);
    s.click(50, 80);
    s.click(2, 1);
    expect(s.commits).toHaveLength(1);
    expect(s.commits[0]!.closed).toBe(true);
    expect(s.commits[0]!.anchors).toHaveLength(3);
  });

  it('closes two nodes only when a drag bends the closing segment', () => {
    const s = setup();
    s.click(0, 0);
    s.click(100, 0);
    s.click(1, 1);
    expect(s.commits).toHaveLength(0);
    s.press(1, 1);
    s.move(0, 40);
    s.up();
    expect(s.commits).toHaveLength(1);
    expect(s.commits[0]!.anchors[0]).toMatchObject({
      mode: 'mirrored',
      handleIn: { x: 0, y: -40 },
    });
  });

  it('finishes on a double-click on the last node', () => {
    const s = setup();
    s.click(0, 0);
    s.press(100, 0);
    s.up();
    clock += 200;
    s.press(100, 0);
    expect(s.commits).toHaveLength(1);
    expect(s.commits[0]!.anchors).toHaveLength(2);
    expect(s.hook.result.current.handlePathDoubleClick()).toBe(true);
  });

  it('turns the last node into a cusp when it is clicked again later', () => {
    const s = setup();
    s.click(0, 0);
    s.press(100, 0);
    s.move(140, 0);
    s.up();
    clock += 1_000;
    s.click(100, 0);
    const last = s.hook.result.current.draft!.anchors[1]!;
    expect(last.handleOut).toBeUndefined();
    expect(last.handleIn).toEqual({ x: 60, y: 0 });
  });

  it('never reads a press that became a drag as the first half of a double-click', () => {
    const s = setup();
    s.click(0, 0);
    s.press(100, 0);
    s.move(140, 0);
    s.up();
    clock += 150;
    s.click(100, 0);
    expect(s.commits).toHaveLength(0);
    expect(s.hook.result.current.draft!.anchors[1]!.handleOut).toBeUndefined();
  });

  it('removes the last node on Backspace and cancels with none left', () => {
    const s = setup();
    s.click(0, 0);
    s.click(50, 0);
    s.key('Backspace');
    expect(s.hook.result.current.draft!.anchors).toHaveLength(1);
    s.key('Backspace');
    expect(s.hook.result.current.draft).toBeNull();
    // With no path in progress the key is the editor's again.
    expect(s.key('Backspace').defaultPrevented).toBe(false);
  });

  it('cancels a single node on Escape and leaves a further Escape to the editor', () => {
    const s = setup();
    s.click(0, 0);
    expect(s.key('Escape').defaultPrevented).toBe(true);
    expect(s.commits).toHaveLength(0);
    expect(s.hook.result.current.draft).toBeNull();
    expect(s.key('Escape').defaultPrevented).toBe(false);
  });

  it('lands the path when another tool is picked', () => {
    const s = setup();
    s.click(0, 0);
    s.click(50, 50);
    s.hook.rerender({ pendingDraw: null, tab: 't' });
    expect(s.commits).toHaveLength(1);
    expect(s.commits[0]!.closed).toBe(false);
  });

  it('drops the path on a tab switch', () => {
    const s = setup();
    s.click(0, 0);
    s.click(50, 50);
    s.hook.rerender({ pendingDraw: PATH, tab: 'other' });
    expect(s.hook.result.current.draft).toBeNull();
    expect(s.commits).toHaveLength(0);
  });

  it('continues an open path from its end and closes it on its other end', () => {
    const open = createPath(
      [
        { x: 0, y: 0, mode: 'corner' },
        { x: 100, y: 0, mode: 'corner' },
      ],
      false,
    );
    const s = setup([open]);
    s.click(100, 0);
    expect(s.hook.result.current.draft).toMatchObject({ continuing: { id: open.id }, placed: 0 });
    s.click(100, 100);
    s.click(0, 1);
    expect(s.commits).toEqual([
      expect.objectContaining({ closed: true, continuing: { id: open.id } }),
    ]);
    expect(s.commits[0]!.anchors).toHaveLength(3);
  });

  it('clears the selection when a new path starts, not while it grows', () => {
    const s = setup();
    s.click(0, 0);
    s.click(50, 0);
    expect(s.onStartPath).toHaveBeenCalledTimes(1);
  });

  it('moves a placed node when it is dragged; a click on it adds nothing', () => {
    const s = setup();
    s.click(0, 0);
    s.click(100, 0);
    s.click(100, 100);
    s.click(101, 1);
    expect(s.hook.result.current.draft!.anchors).toHaveLength(3);
    s.press(100, 0);
    s.move(120, 20);
    s.up();
    expect(s.hook.result.current.draft!.anchors[1]).toMatchObject({ x: 120, y: 20 });
    expect(s.hook.result.current.draft!.anchors).toHaveLength(3);
  });

  it('moves the last node when it is dragged, and cusps it on a later click', () => {
    const s = setup();
    s.click(0, 0);
    s.click(100, 0);
    s.press(100, 0);
    s.move(100, 40);
    s.up();
    expect(s.hook.result.current.draft!.anchors[1]).toMatchObject({ x: 100, y: 40 });
  });

  it('converts a placed node on Alt-click', () => {
    const s = setup();
    s.click(0, 0);
    s.click(60, 30);
    s.click(120, 0);
    s.press(60, 30, { alt: true });
    s.up();
    expect(s.hook.result.current.draft!.anchors[1]!.mode).toBe('mirrored');
    expect(s.hook.result.current.draft!.anchors).toHaveLength(3);
  });

  it('edits the path being drawn with Ctrl held: nodes and handles drag, nothing is placed', () => {
    const s = setup();
    s.click(0, 0);
    s.press(100, 0);
    s.move(140, 0);
    s.up();
    clock += 1_000;
    s.click(200, 100);
    // A handle of node 1, at (140, 0).
    s.press(140, 0, { ctrl: true });
    s.move(140, 40, { ctrl: true });
    s.up();
    expect(s.hook.result.current.draft!.anchors[1]!.handleOut).toEqual({ x: 140, y: 40 });
    // The first node, which a plain press would close on.
    s.press(0, 0, { ctrl: true });
    s.move(0, 30, { ctrl: true });
    s.up();
    expect(s.hook.result.current.draft!.anchors[0]).toMatchObject({ x: 0, y: 30 });
    // Empty space: nothing placed.
    s.press(300, 300, { ctrl: true });
    s.up();
    expect(s.hook.result.current.draft!.anchors).toHaveLength(3);
    expect(s.commits).toHaveLength(0);
  });

  it('shows the edit pointer while Ctrl is held', () => {
    const s = setup();
    s.click(0, 0);
    s.key('Control');
    expect(s.hook.result.current.editPointer).toBe(true);
    s.key('Control', 'keyup');
    expect(s.hook.result.current.editPointer).toBe(false);
  });

  describe('undo while drawing (docs/specs/023-whiteboard/path-tool.md "Drawing")', () => {
    const xs = (s: ReturnType<typeof setup>) =>
      s.hook.result.current.draft?.anchors.map((a) => a.x);

    it('steps back one node at a time on Ctrl+Z and Cmd+Z, keeping the board history out of it', () => {
      const s = setup();
      s.click(0, 0);
      s.press(100, 0);
      s.move(140, 0);
      s.up();
      s.click(200, 0);
      const z = s.chord('z');
      expect(z.defaultPrevented).toBe(true);
      expect(xs(s)).toEqual([0, 100]);
      s.chord('z', { meta: true });
      expect(xs(s)).toEqual([0]);
      expect(s.commits).toHaveLength(0);
    });

    it('redoes the undone nodes in order, handles and all, with Ctrl+Shift+Z and Ctrl+Y', () => {
      const s = setup();
      s.click(0, 0);
      s.press(100, 0);
      s.move(140, 0);
      s.up();
      s.click(200, 0);
      s.chord('z');
      s.chord('z');
      expect(s.hook.result.current.history).toMatchObject({ canUndo: true, canRedo: true });
      s.chord('z', { shift: true });
      expect(xs(s)).toEqual([0, 100]);
      expect(s.hook.result.current.draft!.anchors[1]!.handleOut).toEqual({ x: 140, y: 0 });
      s.chord('y');
      expect(xs(s)).toEqual([0, 100, 200]);
      expect(s.hook.result.current.history!.canRedo).toBe(false);
    });

    it('forgets the undone nodes once a new node is placed', () => {
      const s = setup();
      s.click(0, 0);
      s.click(100, 0);
      s.chord('z');
      s.click(50, 50);
      expect(s.hook.result.current.history!.canRedo).toBe(false);
      s.chord('z', { shift: true });
      expect(xs(s)).toEqual([0, 50]);
    });

    it('cancels the path when no node is left, and leaves undo to the board without one', () => {
      const s = setup();
      s.click(0, 0);
      s.chord('z');
      expect(s.hook.result.current.draft).toBeNull();
      expect(s.hook.result.current.history).toBeNull();
      expect(s.chord('z').defaultPrevented).toBe(false);
    });

    it('gives the dock the same undo and redo', () => {
      const s = setup();
      s.click(0, 0);
      s.click(100, 0);
      act(() => s.hook.result.current.history!.undo());
      expect(xs(s)).toEqual([0]);
      act(() => s.hook.result.current.history!.redo());
      expect(xs(s)).toEqual([0, 100]);
    });
  });

  it('claims nothing when the tool is not in hand', () => {
    const s = setup();
    s.hook.rerender({ pendingDraw: null, tab: 't' });
    expect(s.press(0, 0)).toBe(false);
  });
});
