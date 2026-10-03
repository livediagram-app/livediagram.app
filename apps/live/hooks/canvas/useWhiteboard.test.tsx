// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { track } from '@/lib/telemetry';
import { useWhiteboard } from './useWhiteboard';
import { DEFAULT_WHITEBOARD_PREFS } from '@/lib/whiteboard-prefs';
import {
  readUserPreferences,
  writeUserPreferences,
  type UserPreferences,
} from '@/lib/user-preferences';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const board = (id = 'wb', over: Partial<Tab> = {}): Tab =>
  ({ id, name: 'Board', opensIn: 'draw', elements: [], ...over }) as Tab;
const stroke = {
  id: 's1',
  type: 'freehand',
  x: 0,
  y: 0,
  points: [],
} as unknown as Tab['elements'][number];
const diagram: Tab = { id: 'd', name: 'Diagram', kind: 'diagram', elements: [] } as Tab;

function setup(tab: Tab, pendingDraw: PendingDraw | null = null, canvasTool = 'select' as const) {
  const deps = {
    activeTab: tab,
    drawMode: tab.opensIn === 'draw',
    canvasTool: canvasTool as 'select' | 'eraser',
    pendingDraw,
    editsBlocked: false,
    setCanvasTool: vi.fn(),
    selectCanvasTool: vi.fn(),
    beginDraw: vi.fn(),
    cancelDraw: vi.fn(),
    pathEditing: false,
    leavePathEdit: vi.fn(),
    snapColours: { colours: [], blocked: false, snap: vi.fn(() => 0) },
  };
  // The synced preferences as the editor holds them: state, written through to this browser.
  const hook = renderHook(
    (d: typeof deps) => {
      const [userPreferences, setUserPreferences] = useState<UserPreferences>(readUserPreferences);
      return useWhiteboard({
        ...d,
        userPreferences,
        setUserPreferences,
        writeUserPreferences,
        ownerId: null,
      });
    },
    { initialProps: deps },
  );
  return { deps, hook };
}

afterEach(() => {
  localStorage.clear();
  vi.mocked(track).mockClear();
});

describe('useWhiteboard', () => {
  it('leaves Select in hand when a whiteboard with content opens', () => {
    const { deps } = setup(board('wb', { elements: [stroke] }));
    expect(deps.beginDraw).not.toHaveBeenCalled();
    expect(deps.setCanvasTool).not.toHaveBeenCalled();
  });

  it('puts the active pen in hand when an empty whiteboard opens', () => {
    const { deps } = setup(board());
    expect(deps.beginDraw).toHaveBeenCalledWith({
      type: 'freehand',
      variant: 'whiteboard',
      colour: null,
      width: 1.5,
      recognise: false,
    });
  });

  it('puts the pen in hand when the open tab switches into Draw (or Quick Start makes a board)', () => {
    const blank = { id: 't2', name: 'Tab 2', kind: 'diagram', elements: [] } as Tab;
    const { deps, hook } = setup(blank);
    expect(deps.beginDraw).not.toHaveBeenCalled();
    hook.rerender({ ...deps, drawMode: true });
    expect(deps.beginDraw).toHaveBeenCalledTimes(1);
  });

  // docs/specs/007-editor/editor-modes.md "What a mode brings into focus": leaving a mode puts its
  // tool down; a pen, the eraser or an armed shape never carries over into the other mode.
  // docs/specs/007-editor/editor-modes.md: entering Draw by switching follows the rule for opening.
  it('leaves Select in hand when a tab with content switches into Draw', () => {
    const tab = { id: 't5', name: 'Tab 5', kind: 'diagram', elements: [stroke] } as Tab;
    const { deps, hook } = setup(tab);
    hook.rerender({ ...deps, drawMode: true });
    expect(deps.beginDraw).not.toHaveBeenCalled();
    expect(deps.setCanvasTool).not.toHaveBeenCalled();
  });

  it('puts the pen in hand on every switch into Draw on an empty tab, not only the first', () => {
    const blank = { id: 't6', name: 'Tab 6', kind: 'diagram', elements: [] } as Tab;
    const { deps, hook } = setup(blank);
    hook.rerender({ ...deps, drawMode: true });
    hook.rerender({ ...deps, drawMode: false });
    hook.rerender({ ...deps, drawMode: true });
    expect(deps.beginDraw).toHaveBeenCalledTimes(2);
  });

  it('puts the eraser down when switching out of Draw', () => {
    const { deps, hook } = setup(board('wb', { elements: [stroke] }), null, 'eraser' as never);
    hook.rerender({ ...deps, drawMode: false });
    expect(deps.setCanvasTool).toHaveBeenCalledWith('select');
  });

  it('puts the eraser down and the pen in hand when switching an empty tab into Draw', () => {
    const blank = { id: 't3', name: 'Tab 3', kind: 'diagram', elements: [] } as Tab;
    const { deps, hook } = setup(blank, null, 'eraser' as never);
    hook.rerender({ ...deps, drawMode: true });
    expect(deps.setCanvasTool).toHaveBeenCalledWith('select');
    expect(deps.beginDraw).toHaveBeenCalledTimes(1);
  });

  it('puts a palette shape down when switching into Draw, for Select on a tab with content', () => {
    const tab = { id: 't4', name: 'Tab 4', kind: 'diagram', elements: [stroke] } as Tab;
    const { deps, hook } = setup(tab, { type: 'shape', kind: 'square' });
    expect(deps.cancelDraw).not.toHaveBeenCalled();
    hook.rerender({ ...deps, drawMode: true });
    expect(deps.cancelDraw).toHaveBeenCalledTimes(1);
    expect(deps.beginDraw).not.toHaveBeenCalled();
  });

  it('keeps the eraser in hand moving between two tabs in Draw mode', () => {
    const { deps, hook } = setup(board('a', { elements: [stroke] }), null, 'eraser' as never);
    hook.rerender({ ...deps, activeTab: board('b', { elements: [stroke] }) });
    expect(deps.setCanvasTool).not.toHaveBeenCalled();
  });

  it('leaves a held mode alone when a whiteboard opens', () => {
    const { deps } = setup(board(), null, 'eraser' as never);
    expect(deps.beginDraw).not.toHaveBeenCalled();
  });

  it('puts a whiteboard pen down on a diagram tab', () => {
    const { deps } = setup(diagram, {
      type: 'freehand',
      variant: 'whiteboard',
      colour: null,
      width: 4,
      recognise: false,
    });
    expect(deps.cancelDraw).toHaveBeenCalled();
  });

  it('picks up the Path tool and reports it', () => {
    const { deps, hook } = setup(board());
    act(() => hook.result.current.pickPath());
    expect(deps.setCanvasTool).toHaveBeenCalledWith('select');
    expect(deps.beginDraw).toHaveBeenLastCalledWith({ type: 'path' });
    expect(track).toHaveBeenCalledWith('Draw', 'Selected', 'Path');
  });

  it('puts the Path tool down on a diagram tab', () => {
    const { deps } = setup(diagram, { type: 'path' });
    expect(deps.cancelDraw).toHaveBeenCalled();
  });

  it('arms a picked pen and reports it', () => {
    const { deps, hook } = setup(board());
    act(() => hook.result.current.pickPen('third'));
    expect(deps.beginDraw).toHaveBeenLastCalledWith(
      expect.objectContaining({ variant: 'whiteboard', colour: 'red' }),
    );
    expect(track).toHaveBeenCalledWith('Draw', 'Selected', 'Third');
    expect(hook.result.current.prefs.activePenId).toBe('third');
  });

  it('remembers recognition and eraser mode on this device', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.setRecognition(true));
    act(() => hook.result.current.setEraserMode('partial'));
    expect(track).toHaveBeenCalledWith('Draw', 'Toggled', 'RecognitionOn');
    expect(track).toHaveBeenCalledWith('Draw', 'Changed', 'EraserPartial');
    const stored = JSON.parse(localStorage.getItem('livediagram:v2:whiteboard-pens')!);
    expect(stored).toMatchObject({ recognise: true, eraserMode: 'partial' });
  });

  it('arms a dock shape in the ink, whatever pen was in hand', () => {
    const { deps, hook } = setup(board());
    act(() => hook.result.current.pickPen('second'));
    hook.rerender({ ...deps });
    act(() => hook.result.current.pickShape('diamond'));
    expect(deps.beginDraw).toHaveBeenLastCalledWith({
      type: 'shape',
      kind: 'diamond',
      board: true,
    });
  });

  it('puts down a format painter carried over from a diagram tab', () => {
    const { deps } = setup(board(), null, 'format' as never);
    expect(deps.setCanvasTool).toHaveBeenCalledWith('select');
    expect(deps.beginDraw).toHaveBeenCalled();
  });

  it('puts down a carried-over format painter for Select on a whiteboard with content', () => {
    const { deps } = setup(board('wb', { elements: [stroke] }), null, 'format' as never);
    expect(deps.setCanvasTool).toHaveBeenCalledWith('select');
    expect(deps.beginDraw).not.toHaveBeenCalled();
  });

  // docs/specs/007-editor/editor-modes.md "One look": Draw mode's pattern is the person's own,
  // in the synced preferences, never on the tab.
  it('starts on Grid, whatever the tab stores', () => {
    const { hook } = setup(board('wb', { backgroundPattern: 'blank' }));
    expect(hook.result.current.background).toBe('graph');
  });

  it('stores a background as the person’s Draw pattern, never on the tab', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.setBackground('dots'));
    expect(readUserPreferences().drawPattern).toBe('grid');
    expect(hook.result.current.background).toBe('grid');
    expect(track).toHaveBeenCalledWith('Draw', 'Changed', 'BackgroundDots');
  });

  it('does nothing for the background already chosen', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.setBackground('grid'));
    expect(readUserPreferences().drawPattern).toBeUndefined();
    expect(track).not.toHaveBeenCalledWith('Draw', 'Changed', 'BackgroundGrid');
  });
});

describe('pen cursor', () => {
  it('sets the cursor, remembers it and reports the choice', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.setCursor('dot'));
    expect(hook.result.current.prefs.cursor).toBe('dot');
    expect(track).toHaveBeenCalledWith('Draw', 'Changed', 'CursorDot');
  });
});

describe('pen changes', () => {
  it('resets a pen to its starting colour and width', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.updatePen('second', { colour: '#9061f9', width: 2.5 }));
    act(() => hook.result.current.resetPen('second'));
    expect(hook.result.current.prefs.pens[1]).toEqual(DEFAULT_WHITEBOARD_PREFS.pens[1]);
    expect(track).toHaveBeenCalledWith('Draw', 'Changed', 'PenReset');
  });

  it('does nothing for a pen already as it started', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.resetPen('third'));
    expect(track).not.toHaveBeenCalledWith('Draw', 'Changed', 'PenReset');
  });

  it('reports a new colour and a new width, never the colour itself', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.updatePen('second', { colour: '#9061f9' }));
    act(() => hook.result.current.updatePen('main', { width: 1 }));
    expect(track).toHaveBeenCalledWith('Draw', 'Changed', 'PenColour');
    expect(track).toHaveBeenCalledWith('Draw', 'Changed', 'PenWidth');
  });

  it('remembers a custom colour in Your colours, synced, and nothing for a stock colour', () => {
    // docs/specs/023-draw-mode/draw-mode.md "The colour picker".
    const { hook } = setup(board());
    act(() => hook.result.current.updatePen('second', { colour: 'teal' }));
    act(() => hook.result.current.updatePen('third', { colour: '#FF6B00' }));
    act(() => hook.result.current.updatePen('third', { colour: null }));
    expect(hook.result.current.colourMemory.yours).toEqual(['#ff6b00']);
    expect(readUserPreferences()).toMatchObject({ whiteboardYourColours: ['#ff6b00'] });
    expect(hook.result.current.prefs.pens[2]!.colour).toBeNull();
  });
});

describe('the S key', () => {
  it('raises a request the dock answers by opening its Shapes flyout', () => {
    const { hook } = setup(board());
    const before = hook.result.current.shapesRequest;
    act(() => hook.result.current.openShapes());
    expect(hook.result.current.shapesRequest).toBe(before + 1);
  });
});

describe('shapes from the catalogue', () => {
  it('places a sticky note as a shape: N arms the plain note and counts as a pick', () => {
    const { deps, hook } = setup(board());
    act(() => hook.result.current.pickSticky());
    expect(deps.beginDraw).toHaveBeenLastCalledWith({ type: 'sticky' });
    expect(readUserPreferences().whiteboardShapePicks).toMatchObject({
      sticky: [1, expect.any(Number)],
    });
    // Most used is filled first, so a kind picked once sits there, not in Recent too.
    expect(hook.result.current.slotShapes.mostUsed[0]).toBe('sticky');
    expect(hook.result.current.slotShapes.recent).not.toContain('sticky');
  });

  it('arms any catalogue shape plain, as a board shape, with its creation choice', () => {
    const { deps, hook } = setup(board());
    act(() => hook.result.current.pickShape('session-button:poll'));
    expect(deps.beginDraw).toHaveBeenLastCalledWith({
      type: 'shape',
      kind: 'session-button',
      session: 'poll',
      board: true,
    });
  });

  it('counts every pick towards the frequent slots, in the synced preferences', () => {
    const { hook } = setup(board());
    // The default pins (Arrow, Rectangle) stay off the slots.
    expect(hook.result.current.pinnedShapes).toEqual(['arrow', 'rectangle']);
    expect(hook.result.current.slotShapes).toEqual({
      mostUsed: ['ellipse', 'diamond', 'cylinder'],
      recent: ['line', 'parallelogram', 'hexagon'],
    });
    act(() => hook.result.current.pickShape('triangle'));
    act(() => hook.result.current.pickShape('triangle'));
    act(() => hook.result.current.pickShape('star'));
    // Most used first; Recent the others, newest first.
    expect(hook.result.current.slotShapes.mostUsed.slice(0, 2)).toEqual(['triangle', 'star']);
    expect(readUserPreferences().whiteboardShapePicks).toMatchObject({
      triangle: [2, expect.any(Number)],
      star: [1, expect.any(Number)],
    });
  });

  it('reports a search pick as one fixed token, never the kind', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.pickSearchedShape('hexagon'));
    expect(track).toHaveBeenCalledWith('Draw', 'Selected', 'ShapeSearch');
    expect(vi.mocked(track).mock.calls.flat()).not.toContain('hexagon');
  });

  it('refuses a key the catalogue does not know, arming nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { deps, hook } = setup(board());
    vi.mocked(deps.beginDraw).mockClear();
    act(() => hook.result.current.pickShape('banner' as never));
    expect(deps.beginDraw).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('[whiteboard] unknown shape', 'banner');
    warn.mockRestore();
  });

  it('says which catalogue shape is in hand', () => {
    const { hook } = setup(board(), { type: 'shape', kind: 'hexagon', board: true });
    expect(hook.result.current.armedShape).toBe('hexagon');
  });
});

describe('dock mode and pins', () => {
  it('pins, replaces and unpins, reporting each without the kind', () => {
    const { hook } = setup(board());
    const defaults = hook.result.current.pinnedShapes;
    act(() => hook.result.current.applySlotOutcome({ type: 'pin', pinned: [...defaults, 'star'] }));
    expect(hook.result.current.pinnedShapes).toEqual([...defaults, 'star']);
    expect(track).toHaveBeenLastCalledWith('Draw', 'Changed', 'ShapePinned');
    act(() =>
      hook.result.current.applySlotOutcome({ type: 'pin', pinned: [...defaults, 'cloud'] }),
    );
    expect(track).toHaveBeenLastCalledWith('Draw', 'Changed', 'ShapePinned');
    act(() => hook.result.current.applySlotOutcome({ type: 'unpin', pinned: [...defaults] }));
    expect(track).toHaveBeenLastCalledWith('Draw', 'Changed', 'ShapeUnpinned');
    expect(vi.mocked(track).mock.calls.flat()).not.toContain('cloud');
  });

  it('keeps an emptied pinned side empty, and an unpinned kind keeps its count', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.pickShape('rectangle'));
    act(() => hook.result.current.applySlotOutcome({ type: 'unpin', pinned: [] }));
    expect(hook.result.current.pinnedShapes).toEqual([]);
    expect(readUserPreferences().whiteboardPinnedShapes).toEqual([]);
    // Rectangle was picked once, so it shows in Most used at once.
    expect(hook.result.current.slotShapes.mostUsed[0]).toBe('rectangle');
  });

  it('keeps pinned kinds out of the slots', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.applySlotOutcome({ type: 'pin', pinned: ['rectangle'] }));
    const { mostUsed, recent } = hook.result.current.slotShapes;
    expect([...mostUsed, ...recent]).not.toContain('rectangle');
  });

  it('writes nothing for a refused pin', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.applySlotOutcome({ type: 'refused' }));
    expect(readUserPreferences().whiteboardPinnedShapes).toBeUndefined();
    expect(track).not.toHaveBeenCalled();
  });
});
