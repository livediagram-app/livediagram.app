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
  ({ id, name: 'Board', kind: 'whiteboard', elements: [], ...over }) as Tab;
const diagram: Tab = { id: 'd', name: 'Diagram', kind: 'diagram', elements: [] } as Tab;

function setup(tab: Tab, pendingDraw: PendingDraw | null = null, canvasTool = 'select' as const) {
  const deps = {
    activeTab: tab,
    canvasTool: canvasTool as 'select' | 'eraser',
    pendingDraw,
    editsBlocked: false,
    setCanvasTool: vi.fn(),
    selectCanvasTool: vi.fn(),
    beginDraw: vi.fn(),
    cancelDraw: vi.fn(),
    setBackgroundPattern: vi.fn(),
    pathEditing: false,
    leavePathEdit: vi.fn(),
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
  it('puts the active pen in hand when a whiteboard opens', () => {
    const { deps } = setup(board());
    expect(deps.beginDraw).toHaveBeenCalledWith({
      type: 'freehand',
      variant: 'whiteboard',
      colour: null,
      width: 1.5,
      recognise: false,
    });
  });

  it('puts the pen in hand when the open tab becomes a whiteboard (Quick Start)', () => {
    const blank = { id: 't2', name: 'Tab 2', kind: 'diagram', elements: [] } as Tab;
    const { deps, hook } = setup(blank);
    expect(deps.beginDraw).not.toHaveBeenCalled();
    hook.rerender({ ...deps, activeTab: { ...blank, kind: 'whiteboard' } });
    expect(deps.beginDraw).toHaveBeenCalledTimes(1);
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
    expect(track).toHaveBeenCalledWith('Whiteboard', 'Selected', 'Path');
  });

  it('puts the Path tool down on a diagram tab', () => {
    const { deps } = setup(diagram, { type: 'path' });
    expect(deps.cancelDraw).toHaveBeenCalled();
  });

  it('arms a picked pen and reports it', () => {
    const { deps, hook } = setup(board());
    act(() => hook.result.current.pickPen('third'));
    expect(deps.beginDraw).toHaveBeenLastCalledWith(
      expect.objectContaining({ variant: 'whiteboard', colour: '#e5484d' }),
    );
    expect(track).toHaveBeenCalledWith('Whiteboard', 'Selected', 'Third');
    expect(hook.result.current.prefs.activePenId).toBe('third');
  });

  it('remembers recognition and eraser mode on this device', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.setRecognition(true));
    act(() => hook.result.current.setEraserMode('partial'));
    expect(track).toHaveBeenCalledWith('Whiteboard', 'Toggled', 'RecognitionOn');
    expect(track).toHaveBeenCalledWith('Whiteboard', 'Changed', 'EraserPartial');
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

  it('puts down a highlighter carried over from a diagram tab', () => {
    const { deps } = setup(board(), null, 'highlighter' as never);
    expect(deps.setCanvasTool).toHaveBeenCalledWith('select');
    expect(deps.beginDraw).toHaveBeenCalled();
  });

  it('stores a background on the tab as its pattern', () => {
    const { deps, hook } = setup(board());
    act(() => hook.result.current.setBackground('grid'));
    expect(deps.setBackgroundPattern).toHaveBeenCalledWith('graph');
    expect(track).toHaveBeenCalledWith('Whiteboard', 'Changed', 'BackgroundGrid');
  });

  it('does nothing for the background already on the board', () => {
    const { deps, hook } = setup(board('wb', { backgroundPattern: 'grid' }));
    act(() => hook.result.current.setBackground('dots'));
    expect(deps.setBackgroundPattern).not.toHaveBeenCalled();
  });
});

describe('pen cursor', () => {
  it('sets the cursor, remembers it and reports the choice', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.setCursor('dot'));
    expect(hook.result.current.prefs.cursor).toBe('dot');
    expect(track).toHaveBeenCalledWith('Whiteboard', 'Changed', 'CursorDot');
  });
});

describe('pen changes', () => {
  it('resets a pen to its starting colour and width', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.updatePen('second', { colour: '#9061f9', width: 2.5 }));
    act(() => hook.result.current.resetPen('second'));
    expect(hook.result.current.prefs.pens[1]).toEqual(DEFAULT_WHITEBOARD_PREFS.pens[1]);
    expect(track).toHaveBeenCalledWith('Whiteboard', 'Changed', 'PenReset');
  });

  it('does nothing for a pen already as it started', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.resetPen('third'));
    expect(track).not.toHaveBeenCalledWith('Whiteboard', 'Changed', 'PenReset');
  });

  it('reports a new colour and a new width, never the colour itself', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.updatePen('second', { colour: '#9061f9' }));
    act(() => hook.result.current.updatePen('main', { width: 1 }));
    expect(track).toHaveBeenCalledWith('Whiteboard', 'Changed', 'PenColour');
    expect(track).toHaveBeenCalledWith('Whiteboard', 'Changed', 'PenWidth');
  });
});

describe('shapes from the catalogue', () => {
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
    expect(hook.result.current.frequentShapes).toEqual(['rectangle', 'ellipse']);
    act(() => hook.result.current.pickShape('triangle'));
    act(() => hook.result.current.pickShape('triangle'));
    act(() => hook.result.current.pickShape('star'));
    expect(hook.result.current.frequentShapes).toEqual(['triangle', 'star']);
    expect(readUserPreferences().whiteboardShapePicks).toMatchObject({
      triangle: [2, expect.any(Number)],
      star: [1, expect.any(Number)],
    });
  });

  it('reports a search pick as one fixed token, never the kind', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.pickSearchedShape('hexagon'));
    expect(track).toHaveBeenCalledWith('Whiteboard', 'Selected', 'ShapeSearch');
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
  it('starts With shapes and switches to Simple, reported and synced', () => {
    const { hook } = setup(board());
    expect(hook.result.current.dockMode).toBe('shapes');
    act(() => hook.result.current.setDockMode('simple'));
    expect(hook.result.current.dockMode).toBe('simple');
    expect(track).toHaveBeenCalledWith('Whiteboard', 'Changed', 'ModeSimple');
    expect(readUserPreferences().whiteboardDockMode).toBe('simple');
    act(() => hook.result.current.setDockMode('shapes'));
    expect(track).toHaveBeenCalledWith('Whiteboard', 'Changed', 'ModeShapes');
    expect(readUserPreferences().whiteboardDockMode).toBeUndefined();
  });

  it('does nothing for the mode already in force', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.setDockMode('shapes'));
    expect(track).not.toHaveBeenCalled();
  });

  it('pins, replaces and unpins, reporting each without the kind', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.applySlotOutcome({ type: 'pin', pinned: ['star'] }));
    expect(hook.result.current.pinnedShapes).toEqual(['star']);
    expect(track).toHaveBeenLastCalledWith('Whiteboard', 'Changed', 'ShapePinned');
    act(() => hook.result.current.applySlotOutcome({ type: 'pin', pinned: ['cloud'] }));
    expect(track).toHaveBeenLastCalledWith('Whiteboard', 'Changed', 'ShapePinned');
    act(() => hook.result.current.applySlotOutcome({ type: 'unpin', pinned: [] }));
    expect(track).toHaveBeenLastCalledWith('Whiteboard', 'Changed', 'ShapeUnpinned');
    expect(readUserPreferences().whiteboardPinnedShapes).toBeUndefined();
  });

  it('keeps pinned kinds out of the frequent slots', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.applySlotOutcome({ type: 'pin', pinned: ['rectangle'] }));
    expect(hook.result.current.frequentShapes).toEqual(['ellipse', 'diamond']);
  });

  it('writes nothing for a refused pin', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.applySlotOutcome({ type: 'refused' }));
    expect(readUserPreferences().whiteboardPinnedShapes).toBeUndefined();
    expect(track).not.toHaveBeenCalled();
  });
});
