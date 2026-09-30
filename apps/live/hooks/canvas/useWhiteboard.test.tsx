// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { track } from '@/lib/telemetry';
import { useWhiteboard } from './useWhiteboard';
import { DEFAULT_WHITEBOARD_PREFS } from '@/lib/whiteboard-prefs';

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
  const hook = renderHook((d: typeof deps) => useWhiteboard(d), { initialProps: deps });
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
