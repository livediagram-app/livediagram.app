// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import type { PendingDraw } from '@/lib/draw-mode';
import { whiteboardShapeIntent } from '@/lib/whiteboard-tool';
import { whiteboardShapeEntry } from '@/lib/whiteboard-shape-catalogue';
import { readUserPreferences, writeUserPreferences } from '@/lib/user-preferences';
import { useWhiteboard } from './useWhiteboard';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/023-whiteboard/whiteboard.md "Shapes": a whiteboard keeps its own styles, so its
// tools never reach a diagram tab. A shape, line or arrow armed from the dock is the board's tool,
// previewed in the board's ink and named as the board names it; leaving the board puts it down,
// as it puts a pen down, so a diagram never previews or names its next shape the board's way.

const board: Tab = { id: 'wb', name: 'Board', opensIn: 'draw', elements: [] } as unknown as Tab;
const diagram: Tab = { id: 'd', name: 'Diagram', kind: 'diagram', elements: [] } as unknown as Tab;

function setup(tab: Tab, pendingDraw: PendingDraw | null) {
  const deps = {
    activeTab: tab,
    drawMode: tab.opensIn === 'draw',
    canvasTool: 'select' as const,
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
  const hook = renderHook(
    (d: typeof deps) => {
      const [userPreferences, setUserPreferences] = useState(readUserPreferences);
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

afterEach(() => localStorage.clear());

describe('a whiteboard tool on a diagram tab', () => {
  it.each([
    ['rectangle', whiteboardShapeIntent('rectangle')],
    ['line', whiteboardShapeIntent('line')],
    ['arrow', whiteboardShapeIntent('arrow')],
    ['catalogue triangle', whiteboardShapeEntry('triangle')!.intent],
  ])('puts the board’s %s down on leaving the board', (_, intent) => {
    const { deps, hook } = setup(board, intent);
    expect(deps.cancelDraw).not.toHaveBeenCalled();
    hook.rerender({ ...deps, activeTab: diagram, drawMode: false });
    expect(deps.cancelDraw).toHaveBeenCalledTimes(1);
  });

  it('leaves a diagram’s own palette shape in hand', () => {
    const { deps } = setup(diagram, { type: 'shape', kind: 'square' });
    expect(deps.cancelDraw).not.toHaveBeenCalled();
  });
});
