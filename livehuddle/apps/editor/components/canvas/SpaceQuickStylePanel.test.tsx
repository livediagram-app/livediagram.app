// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyShapeVariant,
  createShape,
  type Element,
  type ShapeElement,
} from '@livehuddle/document';
import type { Selection } from '@liveworkspace/workbench/lib/selection-store';

// docs/specs/008-canvas/space-quick-style.md: a room's Walls, Floor and Floor Colour, a piece's Type, while editing.

const state = vi.hoisted(() => ({
  selection: { selectedId: null, multiSelectedIds: new Set<string>() } as Selection,
  elements: [] as Element[],
  isReadOnly: false,
  contextMenu: null as unknown,
  mobile: false,
}));
const actions = vi.hoisted(() => ({
  setRoomWallsSelected: vi.fn(),
  setRoomFloorSelected: vi.fn(),
  setRoomFloorColourSelected: vi.fn(),
  setPieceTypeSelected: vi.fn(),
}));
vi.mock('@/app/document/[id]/EditorContext', () => ({
  useEditorContext: () => ({
    activeTab: { elements: state.elements },
    isReadOnly: state.isReadOnly,
    contextMenu: state.contextMenu,
    ...actions,
  }),
}));
vi.mock('@liveworkspace/workbench/hooks/canvas/useSelectionStore', () => ({
  useSelectionOf: (pick: (s: Selection) => unknown) => pick(state.selection),
}));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => state.mobile,
}));
vi.mock('@liveworkspace/workbench/hooks/ui/useQuickStylePlacement', () => ({
  useQuickStylePlacement: () => ({ left: 12, top: 40 }),
}));

import { SpaceQuickStylePanel, spaceQuickStyleTarget } from './SpaceQuickStylePanel';

const room = (id: string): ShapeElement => ({ ...createShape('room', 0, 0), id });
const rug = (id: string): ShapeElement => ({ ...createShape('rug', 0, 0), id });
const select = (...ids: string[]) => {
  state.selection = { selectedId: ids[0] ?? null, multiSelectedIds: new Set(ids) };
};
const panel = () => screen.queryByRole('region', { name: 'Quick style' });

beforeEach(() => {
  state.elements = [
    room('r1'),
    room('r2'),
    rug('g1'),
    rug('g2'),
    { ...createShape('sofa', 0, 0), id: 's' },
  ];
  state.isReadOnly = false;
  state.contextMenu = null;
  state.mobile = false;
  select();
  Object.values(actions).forEach((f) => f.mockClear());
});
afterEach(cleanup);

describe('spaceQuickStyleTarget', () => {
  it('styles rooms, or pieces of one kind with a type, and nothing mixed', () => {
    const els = state.elements;
    expect(spaceQuickStyleTarget(els, ['r1', 'r2'])?.kind).toBe('room');
    expect(spaceQuickStyleTarget(els, ['g1', 'g2'])?.kind).toBe('type');
    expect(spaceQuickStyleTarget(els, ['r1', 'g1'])).toBeNull();
    expect(spaceQuickStyleTarget(els, ['s'])).toBeNull();
    expect(spaceQuickStyleTarget(els, ['gone'])).toBeNull();
    expect(spaceQuickStyleTarget(els, [])).toBeNull();
  });
});

describe('SpaceQuickStylePanel', () => {
  it("shows a room's Walls, Floor and Floor Colour, and sets each through the editor", () => {
    select('r1');
    render(<SpaceQuickStylePanel editing />);
    const p = panel()!;
    expect(within(p).getByRole('group', { name: 'Walls' })).toBeTruthy();
    fireEvent.click(within(p).getByRole('button', { name: 'Glass' }));
    expect(actions.setRoomWallsSelected).toHaveBeenCalledWith('glass');
    fireEvent.click(within(p).getByRole('button', { name: 'Carpet' }));
    expect(actions.setRoomFloorSelected).toHaveBeenCalledWith('carpet');
    fireEvent.click(within(p).getByRole('button', { name: 'Navy' }));
    expect(actions.setRoomFloorColourSelected).toHaveBeenCalledTimes(1);
  });

  it("shows a rug's types, the one it has chosen", () => {
    state.elements = [...state.elements, { ...applyShapeVariant(rug('g3'), 'round'), id: 'g3' }];
    select('g3');
    render(<SpaceQuickStylePanel editing />);
    const types = within(panel()!).getByRole('group', { name: 'Type' });
    const buttons = within(types).getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(2);
    fireEvent.click(buttons[0]!);
    expect(actions.setPieceTypeSelected).toHaveBeenCalledWith('rug', expect.any(String));
  });

  it('hides while walking, for a Participant or Viewer, with a menu open, on a phone, or for a chair', () => {
    select('r1');
    const { rerender } = render(<SpaceQuickStylePanel editing={false} />);
    expect(panel()).toBeNull();
    state.isReadOnly = true;
    rerender(<SpaceQuickStylePanel editing />);
    expect(panel()).toBeNull();
    state.isReadOnly = false;
    state.contextMenu = { mode: 'element' };
    rerender(<SpaceQuickStylePanel editing />);
    expect(panel()).toBeNull();
    state.contextMenu = null;
    state.mobile = true;
    rerender(<SpaceQuickStylePanel editing />);
    expect(panel()).toBeNull();
    state.mobile = false;
    select('s');
    rerender(<SpaceQuickStylePanel editing />);
    expect(panel()).toBeNull();
  });
});
