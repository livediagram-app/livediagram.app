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
  mods: { alt?: boolean; shift?: boolean } = {},
) {
  return new MouseEvent(type, { clientX: x, clientY: y, altKey: mods.alt, shiftKey: mods.shift });
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
  const hook = renderHook(
    (p: { pendingDraw: PendingDraw | null; tab: string }) =>
      usePathDrawGesture({
        pendingDraw: p.pendingDraw,
        elements,
        wrapperRef: { current: wrapper },
        viewportZoom: zoom,
        activeTabId: p.tab,
        onCommitPath: (c) => commits.push(c),
      }),
    { initialProps: { pendingDraw: PATH as PendingDraw | null, tab: 't' } },
  );
  const press = (x: number, y: number, mods: { shift?: boolean } = {}) => {
    let claimed = false;
    act(() => {
      claimed = hook.result.current.beginPathPress({
        button: 0,
        clientX: x,
        clientY: y,
        shiftKey: !!mods.shift,
      } as ReactPointerEvent);
    });
    return claimed;
  };
  const move = (x: number, y: number, mods: { alt?: boolean; shift?: boolean } = {}) =>
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
    const e = new KeyboardEvent(type, { key: k, code: k === ' ' ? 'Space' : k, cancelable: true });
    act(() => {
      window.dispatchEvent(e);
    });
    return e;
  };
  return { hook, commits, press, move, up, click, key };
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

  it('claims nothing when the tool is not in hand', () => {
    const s = setup();
    s.hook.rerender({ pendingDraw: null, tab: 't' });
    expect(s.press(0, 0)).toBe(false);
  });
});
