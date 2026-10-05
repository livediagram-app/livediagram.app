import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livediagram/document';
import { presetSetup } from '@livediagram/items';
import { statusColumnsOf } from './usePlanStatusNames';

// docs/specs/025-plan/plan-board.md "All Cards".
describe('statusColumnsOf', () => {
  it('names each status once, in board and column order, skipping All Cards and Archive boards', () => {
    const board = (preset: Parameters<typeof presetSetup>[0]) =>
      ({ ...createShape('plan-board', 0, 0), planBoard: presetSetup(preset) }) as Element;
    const names = statusColumnsOf([
      board('blank'),
      board('kanban'),
      board('all-cards'),
      board('archive'),
    ]);
    expect(names[0]).toEqual(['todo', 'To do']);
    expect(names.filter(([s]) => s === 'todo')).toHaveLength(1);
    expect(names.some(([s]) => s === 'all' || s === 'archived')).toBe(false);
  });
});
