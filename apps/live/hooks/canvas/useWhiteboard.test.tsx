// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/diagram';
import type { PendingDraw } from '@/lib/draw-mode';
import { track } from '@/lib/telemetry';
import { useWhiteboard } from './useWhiteboard';

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
      width: 4,
      recognise: false,
    });
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

  it('arms a picked pen and reports it', () => {
    const { deps, hook } = setup(board());
    act(() => hook.result.current.pickPen('red'));
    expect(deps.beginDraw).toHaveBeenLastCalledWith(
      expect.objectContaining({ variant: 'whiteboard', colour: '#e5484d' }),
    );
    expect(track).toHaveBeenCalledWith('Whiteboard', 'Selected', 'Red');
    expect(hook.result.current.prefs.activePenId).toBe('red');
  });

  it('remembers recognition and eraser mode on this device', () => {
    const { hook } = setup(board());
    act(() => hook.result.current.toggleRecognition());
    act(() => hook.result.current.setEraserMode('partial'));
    expect(track).toHaveBeenCalledWith('Whiteboard', 'Toggled', 'RecognitionOn');
    expect(track).toHaveBeenCalledWith('Whiteboard', 'Changed', 'EraserPartial');
    const stored = JSON.parse(localStorage.getItem('livediagram:v2:whiteboard-pens')!);
    expect(stored).toMatchObject({ recognise: true, eraserMode: 'partial' });
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
