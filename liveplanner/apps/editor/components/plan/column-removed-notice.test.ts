import { describe, expect, it } from 'vitest';
import { boardsStillShowing, columnRemovedCopy } from './column-removed-notice';

// docs/specs/026-plan/plan-board.md "A column's own settings": Remove Column's notice (Work Tracker 1048).
describe("Remove Column's notice", () => {
  it('says nothing for an empty column', () => {
    expect(columnRemovedCopy('To Do', 0, [])).toBeNull();
  });

  it('points at Search when no board shows the state any more', () => {
    expect(columnRemovedCopy('To Do', 2, [])).toBe(
      'To Do is off this board. Its 2 cards are on no board now: find them with Search.',
    );
    expect(columnRemovedCopy('To Do', 1, [])).toBe(
      'To Do is off this board. Its card is on no board now: find it with Search.',
    );
  });

  it('names the boards that still show it', () => {
    expect(columnRemovedCopy('To Do', 2, ['Sprint'])).toBe(
      'To Do is off this board. Its 2 cards are still on Sprint.',
    );
    expect(columnRemovedCopy('To Do', 1, ['Sprint', 'Roadmap'])).toBe(
      'To Do is off this board. Its card is still on Sprint and 1 more board.',
    );
    expect(columnRemovedCopy('To Do', 3, ['Sprint', 'Roadmap', 'Ops'])).toContain(
      'Sprint and 2 more boards',
    );
  });

  it('leaves out the board it came off, once, even when another shares its title', () => {
    const boards = [
      { title: 'Kanban', statuses: ['todo', 'done'] },
      { title: 'Sprint', statuses: ['doing'] },
      { title: 'Kanban', statuses: ['todo'] },
    ];
    expect(boardsStillShowing(boards, 'todo', 'Kanban')).toEqual(['Kanban']);
    expect(boardsStillShowing(boards, 'doing', 'Kanban')).toEqual(['Sprint']);
    expect(boardsStillShowing(boards, 'gone', 'Kanban')).toEqual([]);
  });
});
