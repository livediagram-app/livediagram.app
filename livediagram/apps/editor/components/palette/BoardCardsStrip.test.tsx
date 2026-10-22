// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Element } from '@livediagram/document';

const plan = vi.hoisted(() => ({
  current: null as null | {
    canEdit: boolean;
    types: { id: string; label: string; color: string; glyph: string }[];
  },
}));
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan.current }));
vi.mock('./PaletteTileGrid', () => ({
  PaletteTile: ({ def }: { def: { label: string } }) => <button type="button">{def.label}</button>,
}));

import { BoardCardsStrip } from './BoardCardsStrip';

// docs/specs/026-plan/plan-board.md "The palette follows what fills the screen": a covering board's own cards.
const types = [
  { id: 'task', label: 'Task', color: '#2563eb', glyph: 'task' },
  { id: 'bug', label: 'Bug', color: '#dc2626', glyph: 'bug' },
];
const board = (planBoard: object): Element[] =>
  [
    { id: 'b', type: 'shape', shape: 'plan-board', x: 0, y: 0, width: 1, height: 1, planBoard },
  ] as unknown as Element[];
const show = (elements: Element[]) =>
  render(
    <BoardCardsStrip boardId="b" elements={elements} actions={{} as never} pendingDraw={null} />,
  );

describe('BoardCardsStrip', () => {
  it('holds a tile for each card type the board takes', () => {
    plan.current = { canEdit: true, types };
    show(board({ columns: [{ id: 'c', name: 'To Do' }], addTypes: ['bug'] }));
    expect(screen.getByRole('group', { name: 'Add Cards' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add Bug Card' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add Task Card' })).toBeNull();
  });

  it('is not shown for an Archive board, or someone who may not edit', () => {
    plan.current = { canEdit: true, types };
    const { unmount } = show(board({ columns: [{ id: 'c', name: 'Archive' }], archive: true }));
    expect(screen.queryByRole('group')).toBeNull();
    unmount();
    plan.current = { canEdit: false, types };
    show(board({ columns: [{ id: 'c', name: 'To Do' }] }));
    expect(screen.queryByRole('group')).toBeNull();
  });
});
