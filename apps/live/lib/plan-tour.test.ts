// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EXAMPLE_BOARD_TITLE,
  EXAMPLE_SHEET_SIZE,
  EXAMPLE_SHEET_TITLE,
  exampleSheet,
  PLAN_TOUR_CONTENT_KEY,
  PLAN_TOUR_RELAUNCH_EVENT,
  exampleBoard,
  exampleCards,
  exampleStatus,
  readLeftover,
  requestPlanTourRelaunch,
  writeLeftover,
} from './plan-tour';
import { takePlacedSheet } from './sheet-seeds';

// The Plan tour's tour content and relaunch (docs/specs/026-plan/plan-tour.md "Tour content").

afterEach(() => localStorage.clear());

describe('exampleBoard', () => {
  it('is a Kanban board of its own, titled as an example, centred on the point', () => {
    const board = exampleBoard({ x: 1000, y: 500 }, () => 0);
    expect(board.shape).toBe('plan-board');
    expect(board.planBoard.title).toBe(EXAMPLE_BOARD_TITLE);
    expect(board.planBoard.columns.map((c) => c.id)).toEqual([
      'backlog',
      'todo',
      'doing',
      'review',
      'done',
    ]);
    // Statuses of its own, so no existing card lands on it.
    expect(board.planBoard.columns.every((c) => c.status.includes('~'))).toBe(true);
    expect(board.x + board.width / 2).toBe(1000);
    expect(board.y + board.height / 2).toBe(500);
  });
});

describe('exampleSheet', () => {
  it('is a Sheet placed already set up from the Budget start, centred on the point', () => {
    const sheet = exampleSheet({ x: 1000, y: 500 });
    expect(sheet.shape).toBe('plan-sheet');
    expect(sheet.width).toBe(EXAMPLE_SHEET_SIZE.width);
    expect(sheet.x + sheet.width / 2).toBe(1000);
    expect(sheet.y + sheet.height / 2).toBe(500);
    expect(takePlacedSheet(sheet.planSheet.sheetId)).toEqual({
      title: EXAMPLE_SHEET_TITLE,
      setUp: 'budget',
    });
  });
});

describe('exampleCards', () => {
  it('puts two tasks in To do and an action in Backlog, on the example board only', () => {
    const { planBoard } = exampleBoard({ x: 0, y: 0 });
    let n = 0;
    const cards = exampleCards(planBoard, () => `id${n++}`);
    expect(cards.map((c) => [c.id, c.type, c.fields['title'], c.place?.status])).toEqual([
      ['id0', 'task', 'Plan the launch', exampleStatus(planBoard, 'todo')],
      ['id1', 'task', 'Write the release notes', exampleStatus(planBoard, 'todo')],
      ['id2', 'action', 'Agree the launch date', exampleStatus(planBoard, 'backlog')],
    ]);
  });

  it('leaves a card unplaced on a board without the column', () => {
    const { planBoard } = exampleBoard({ x: 0, y: 0 });
    const cards = exampleCards({ ...planBoard, columns: [] });
    expect(cards.every((c) => c.place === undefined)).toBe(true);
  });
});

describe('the leftover record', () => {
  it('round-trips, and clears', () => {
    const content = { documentId: 'doc', elementId: 'b', itemIds: ['a', 'b'] };
    writeLeftover(content);
    expect(readLeftover()).toEqual(content);
    writeLeftover(null);
    expect(readLeftover()).toBeNull();
  });

  it("keeps the example sheet's sheet id", () => {
    const content = { documentId: 'doc', elementId: 'e', sheetId: 's', itemIds: [] };
    writeLeftover(content);
    expect(readLeftover()).toEqual(content);
  });

  it('reads a record written before the Sheets track as its element', () => {
    localStorage.setItem(
      PLAN_TOUR_CONTENT_KEY,
      JSON.stringify({ documentId: 'doc', boardId: 'b', itemIds: ['i'] }),
    );
    expect(readLeftover()).toEqual({ documentId: 'doc', elementId: 'b', itemIds: ['i'] });
  });

  it('drops a malformed value instead of throwing', () => {
    localStorage.setItem(PLAN_TOUR_CONTENT_KEY, '{"documentId":1}');
    expect(readLeftover()).toBeNull();
    expect(localStorage.getItem(PLAN_TOUR_CONTENT_KEY)).toBeNull();
    localStorage.setItem(
      PLAN_TOUR_CONTENT_KEY,
      JSON.stringify({ documentId: 'd', elementId: 'e', sheetId: 4, itemIds: [] }),
    );
    expect(readLeftover()).toBeNull();
    localStorage.setItem(PLAN_TOUR_CONTENT_KEY, 'not json');
    expect(readLeftover()).toBeNull();
  });

  it('survives storage that throws', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readLeftover()).toBeNull();
    expect(() => writeLeftover({ documentId: 'd', elementId: 'b', itemIds: [] })).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });
});

describe('requestPlanTourRelaunch', () => {
  it('dispatches the relaunch event', () => {
    const heard = vi.fn();
    window.addEventListener(PLAN_TOUR_RELAUNCH_EVENT, heard);
    requestPlanTourRelaunch();
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(PLAN_TOUR_RELAUNCH_EVENT, heard);
  });
});
