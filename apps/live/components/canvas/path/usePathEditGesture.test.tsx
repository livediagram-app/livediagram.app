// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createPath, type PathAnchor, type PathElement } from '@livediagram/document';
import { usePathEditGesture } from './usePathEditGesture';

// A path's edit mode (docs/specs/023-whiteboard/path-tool.md "Editing").

const corner = (x: number, y: number): PathAnchor => ({ x, y, mode: 'corner' });

let clock = 0;
beforeEach(() => {
  clock = 1_000;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

type Mods = { alt?: boolean; shift?: boolean };

function setup(el: PathElement | null, selectedPathId: string | null = null) {
  const wrapper = document.createElement('div');
  wrapper.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect;
  const commits: { id: string; anchors: PathAnchor[]; closed: boolean; kind: string }[] = [];
  const onLeave = vi.fn();
  const onDeselect = vi.fn();
  const onBeginEdit = vi.fn();
  const hook = renderHook(
    (p: { element: PathElement | null }) =>
      usePathEditGesture({
        element: p.element,
        selectedPathId,
        wrapperRef: { current: wrapper },
        viewportZoom: 1,
        onCommitPathEdit: (id, next, kind) => commits.push({ id, ...next, kind }),
        onLeave,
        onDeselect,
        onBeginEdit,
      }),
    { initialProps: { element: el } },
  );
  const press = (x: number, y: number, mods: Mods = {}) => {
    let claimed = false;
    act(() => {
      claimed = hook.result.current.beginEditPress({
        button: 0,
        clientX: x,
        clientY: y,
        altKey: !!mods.alt,
        shiftKey: !!mods.shift,
      } as ReactPointerEvent);
    });
    return claimed;
  };
  const move = (x: number, y: number, mods: Mods = {}) =>
    act(() => {
      window.dispatchEvent(
        new MouseEvent('pointermove', {
          clientX: x,
          clientY: y,
          altKey: mods.alt,
          shiftKey: mods.shift,
        }),
      );
    });
  const up = (x: number, y: number) =>
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: x, clientY: y }));
    });
  const click = (x: number, y: number, mods: Mods = {}) => {
    press(x, y, mods);
    up(x, y);
    clock += 1_000;
  };
  const key = (k: string, mods: { shift?: boolean; meta?: boolean } = {}) => {
    const e = new KeyboardEvent('keydown', {
      key: k,
      shiftKey: mods.shift,
      metaKey: mods.meta,
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(e);
    });
    return e;
  };
  return { hook, commits, onLeave, onDeselect, onBeginEdit, press, move, up, click, key };
}

// An open path: (100,100) → (300,100) → (300,300).
const open = () => createPath([corner(100, 100), corner(300, 100), corner(300, 300)], false);

describe('usePathEditGesture', () => {
  it('selects a node on a click, Shift adds, and a drag moves the selected nodes as one step', () => {
    const s = setup(open());
    s.click(300, 100);
    expect([...s.hook.result.current.selected]).toEqual([1]);
    s.click(300, 300, { shift: true });
    expect([...s.hook.result.current.selected].sort()).toEqual([1, 2]);
    s.press(300, 100);
    s.move(340, 125);
    s.move(350, 150);
    expect(s.hook.result.current.draft![1]).toMatchObject({ x: 350, y: 150 });
    s.up(350, 150);
    expect(s.commits).toHaveLength(1);
    expect(s.commits[0]!.anchors.map((a) => [a.x, a.y])).toEqual([
      [100, 100],
      [350, 150],
      [350, 350],
    ]);
    expect(s.hook.result.current.draft).toBeNull();
  });

  it('snaps a dragged node into line with another and shows the guide', () => {
    const s = setup(open());
    s.press(300, 300);
    s.move(150, 104);
    expect(s.hook.result.current.draft![2]).toMatchObject({ x: 150, y: 100 });
    expect(s.hook.result.current.guides).toEqual({ y: 100 });
    s.up(150, 104);
  });

  it('adds a node on a click on a segment, the shape kept, and selects it', () => {
    const s = setup(open());
    s.click(200, 101);
    expect(s.commits).toHaveLength(1);
    expect(s.commits[0]!.anchors).toHaveLength(4);
    expect(s.commits[0]!.anchors[1]).toMatchObject({ x: 200, y: 100 });
    expect([...s.hook.result.current.selected]).toEqual([1]);
  });

  it('bends a segment through the pointer when it is dragged', () => {
    const s = setup(open());
    s.press(200, 100);
    s.move(200, 140);
    s.up(200, 140);
    expect(s.commits).toHaveLength(1);
    const [a, b] = s.commits[0]!.anchors;
    expect(a!.handleOut).toBeDefined();
    expect(b!.handleIn).toBeDefined();
  });

  it('toggles a node smooth on Alt-click and on a double-click', () => {
    const s = setup(open());
    s.click(300, 100, { alt: true });
    expect(s.commits[0]!.anchors[1]!.mode).toBe('mirrored');
    const smooth = createPath(s.commits[0]!.anchors, false);
    s.hook.rerender({ element: { ...smooth, id: open().id } });
    s.press(300, 100);
    s.up(300, 100);
    clock += 100;
    s.press(300, 100);
    expect(s.commits.at(-1)!.anchors[1]).toEqual(corner(300, 100));
  });

  it('drags a selected node’s handle; its partner follows', () => {
    const el = createPath(
      [
        corner(100, 100),
        {
          x: 300,
          y: 100,
          mode: 'mirrored',
          handleIn: { x: 250, y: 100 },
          handleOut: { x: 350, y: 100 },
        },
      ],
      false,
    );
    const s = setup(el);
    s.click(300, 100);
    s.press(350, 100);
    s.move(300, 160);
    s.up(300, 160);
    expect(s.commits.at(-1)!.anchors[1]).toMatchObject({
      handleOut: { x: 300, y: 160 },
      handleIn: { x: 300, y: 40 },
    });
  });

  it('selects the nodes inside a box drawn on empty space', () => {
    const s = setup(open());
    s.press(250, 50);
    s.move(350, 350);
    expect(s.hook.result.current.box).toEqual({ from: { x: 250, y: 50 }, to: { x: 350, y: 350 } });
    s.up(350, 350);
    expect([...s.hook.result.current.selected]).toEqual([1, 2]);
    expect(s.onLeave).not.toHaveBeenCalled();
  });

  it('leaves edit mode and deselects on a click on empty space', () => {
    const s = setup(open());
    s.click(600, 600);
    expect(s.onLeave).toHaveBeenCalled();
    expect(s.onDeselect).toHaveBeenCalled();
    expect(s.commits).toHaveLength(0);
  });

  it('clears the nodes on Escape, then leaves; Enter leaves', () => {
    const s = setup(open());
    s.click(300, 100);
    expect(s.key('Escape').defaultPrevented).toBe(true);
    expect(s.hook.result.current.selected.size).toBe(0);
    expect(s.onLeave).not.toHaveBeenCalled();
    s.key('Escape');
    expect(s.onLeave).toHaveBeenCalledTimes(1);
    s.key('Enter');
    expect(s.onLeave).toHaveBeenCalledTimes(2);
  });

  it('deletes the selected nodes, and the path with them when too few are left', () => {
    const s = setup(open());
    s.click(300, 100);
    s.key('Delete');
    expect(s.commits[0]!.anchors).toHaveLength(2);
    expect(s.onLeave).not.toHaveBeenCalled();
    s.click(100, 100);
    s.click(300, 300, { shift: true });
    s.key('Backspace');
    expect(s.commits[1]!.anchors).toHaveLength(1);
    expect(s.onLeave).toHaveBeenCalled();
  });

  it('nudges the selected nodes with the arrows, 10 px with Shift', () => {
    const s = setup(open());
    s.click(300, 300);
    s.key('ArrowLeft');
    s.key('ArrowDown', { shift: true });
    expect(s.commits[0]!.anchors[2]).toMatchObject({ x: 299, y: 300 });
    expect(s.commits[1]!.anchors[2]).toMatchObject({ x: 300, y: 310 });
  });

  it('joins the two ends with J', () => {
    const s = setup(open());
    s.click(100, 100);
    s.key('j');
    expect(s.commits).toHaveLength(0);
    s.click(300, 300, { shift: true });
    s.key('j');
    expect(s.commits[0]).toMatchObject({ closed: true, kind: 'join' });
  });

  it('walks the nodes with Tab and selects them all with Cmd+A', () => {
    const s = setup(open());
    s.key('Tab');
    expect([...s.hook.result.current.selected]).toEqual([0]);
    s.key('Tab');
    expect([...s.hook.result.current.selected]).toEqual([1]);
    s.key('Tab', { shift: true });
    expect([...s.hook.result.current.selected]).toEqual([0]);
    s.key('a', { meta: true });
    expect([...s.hook.result.current.selected]).toEqual([0, 1, 2]);
  });

  it('stays in edit mode through undo and redo, leaving the key to the editor', () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const el = open();
    const s = setup(el);
    const z = s.key('z', { meta: true });
    expect(z.defaultPrevented).toBe(false);
    act(() => {
      vi.runAllTimers();
    });
    expect(s.onBeginEdit).toHaveBeenCalledWith(el.id);
    vi.useRealTimers();
  });

  it('sets the node type of the selected nodes from the toolbar, as one step', () => {
    const s = setup(open());
    s.click(300, 100);
    act(() => s.hook.result.current.setNodeType('mirrored'));
    expect(s.commits[0]!.anchors[1]!.mode).toBe('mirrored');
    expect(s.commits[0]!.kind).toBe('edit');
    expect([...s.hook.result.current.selected]).toEqual([1]);
  });

  it('deletes, closes and opens from the toolbar, and Done leaves', () => {
    const s = setup(open());
    act(() => s.hook.result.current.toggleClosed());
    expect(s.commits[0]).toMatchObject({ closed: true, kind: 'join' });
    const closed = { ...open(), closed: true };
    s.hook.rerender({ element: closed });
    s.click(300, 100);
    act(() => s.hook.result.current.toggleClosed());
    expect(s.commits[1]).toMatchObject({ closed: false });
    expect(s.commits[1]!.anchors.map((a) => [a.x, a.y])).toEqual([
      [300, 100],
      [300, 300],
      [100, 100],
      [300, 100],
    ]);
    s.click(300, 300);
    act(() => s.hook.result.current.deleteSelected());
    expect(s.commits[2]!.anchors).toHaveLength(2);
    act(() => s.hook.result.current.done());
    expect(s.onLeave).toHaveBeenCalled();
  });

  it('selects a node held under a finger and brings the toolbar to it', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const s = setup(open());
    act(() => {
      s.hook.result.current.beginEditPress({
        button: 0,
        clientX: 300,
        clientY: 300,
        pointerType: 'touch',
      } as ReactPointerEvent);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect([...s.hook.result.current.selected]).toEqual([2]);
    expect(s.hook.result.current.toolbarAt).toBe(2);
    s.up(300, 300);
    expect(s.commits).toHaveLength(0);
    vi.useRealTimers();
  });

  it('reaches a node 16 px from a finger, 12 px from a mouse', () => {
    const s = setup(open());
    const pressAs = (pointerType: string) => {
      act(() => {
        s.hook.result.current.beginEditPress({
          button: 0,
          clientX: 314,
          clientY: 100,
          pointerType,
        } as ReactPointerEvent);
      });
      s.up(314, 100);
      clock += 1_000;
    };
    pressAs('mouse');
    expect(s.hook.result.current.selected.size).toBe(0);
    pressAs('touch');
    expect([...s.hook.result.current.selected]).toEqual([1]);
  });

  it('tabs past the last node into the edit toolbar, whose buttons keep their keys', () => {
    const s = setup(open());
    const bar = document.createElement('div');
    bar.setAttribute('data-canvas-toolbar', '');
    bar.setAttribute('data-path-edit-toolbar', '');
    const button = document.createElement('button');
    bar.appendChild(button);
    document.body.appendChild(bar);
    s.key('Tab');
    s.key('Tab');
    s.key('Tab');
    expect([...s.hook.result.current.selected]).toEqual([2]);
    s.key('Tab');
    expect(document.activeElement).toBe(button);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => {
      button.dispatchEvent(enter);
    });
    expect(enter.defaultPrevented).toBe(false);
    expect(s.onLeave).not.toHaveBeenCalled();
    bar.remove();
  });

  it('opens edit mode on Enter with one path selected', () => {
    const s = setup(null, 'p1');
    const e = s.key('Enter');
    expect(e.defaultPrevented).toBe(true);
    expect(s.onBeginEdit).toHaveBeenCalledWith('p1');
    expect(s.press(0, 0)).toBe(false);
  });
});
