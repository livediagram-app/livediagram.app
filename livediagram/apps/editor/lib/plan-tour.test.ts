// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PLAN_TOUR_CONTENT_KEY,
  PLAN_TOUR_RELAUNCH_EVENT,
  readLeftover,
  requestPlanTourRelaunch,
  writeLeftover,
} from './plan-tour';

// The Plan tour's tour content and relaunch (docs/specs/026-plan/plan-tour.md "Tour content").

afterEach(() => localStorage.clear());

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
