// Test helpers for the whiteboard dock's component tests: a dock model of spies, and the dock
// rendered around it.
import { render, type RenderResult } from '@testing-library/react';
import { vi, type Mock } from 'vitest';
import { DEFAULT_WHITEBOARD_PREFS } from '@/lib/whiteboard-prefs';
import type { WhiteboardTool } from '@/lib/whiteboard-tool';
import type { WhiteboardDockModel } from '@/hooks/canvas/useWhiteboard';
import { WhiteboardDock } from './WhiteboardDock';

export function dockModel(
  tool: WhiteboardTool = 'pen',
  over: Partial<WhiteboardDockModel> = {},
): WhiteboardDockModel {
  return {
    whiteboard: true,
    tool,
    prefs: DEFAULT_WHITEBOARD_PREFS,
    activePen: DEFAULT_WHITEBOARD_PREFS.pens[0]!,
    background: 'blank' as const,
    pickSelect: vi.fn(),
    pickPen: vi.fn(),
    updatePen: vi.fn(),
    resetPen: vi.fn(),
    pickEraser: vi.fn(),
    setEraserMode: vi.fn(),
    pickSticky: vi.fn(),
    pickText: vi.fn(),
    pickShape: vi.fn(),
    pickSearchedShape: vi.fn(),
    armedShape: null,
    dockMode: 'shapes' as const,
    setDockMode: vi.fn(),
    pinnedShapes: [],
    slotShapes: {
      mostUsed: ['diamond', 'cylinder', 'line'],
      recent: ['parallelogram', 'hexagon', 'document'],
    },
    applySlotOutcome: vi.fn(),
    pickPath: vi.fn(),
    pathEditing: false,
    leavePathEdit: vi.fn(),
    setRecognition: vi.fn(),
    setCursor: vi.fn(),
    setBackground: vi.fn(),
    ...over,
  };
}

export function renderDock(
  m: WhiteboardDockModel = dockModel(),
  extra: { canUndo?: boolean; canRedo?: boolean } = {},
): { m: WhiteboardDockModel; onUndo: Mock; onRedo: Mock; view: RenderResult } {
  const onUndo = vi.fn();
  const onRedo = vi.fn();
  const view = render(
    <WhiteboardDock
      model={m}
      ink="#1c1917"
      canUndo={extra.canUndo ?? true}
      canRedo={extra.canRedo ?? false}
      onUndo={onUndo}
      onRedo={onRedo}
    />,
  );
  return { m, onUndo, onRedo, view };
}
