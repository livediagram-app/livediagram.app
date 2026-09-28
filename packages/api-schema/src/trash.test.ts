import { describe, expect, it } from 'vitest';
import { TRASH_RETENTION_MS, trashDaysLeft, trashPurgeDueAt, isTrashExpired } from './trash';

// The Trash's clock (docs/specs/013-workspace/trash.md): 30 days from
// deletion, "days left" rounded up, shared by the api cron, the Trash view
// and the Offline Mode local Trash so the three can never disagree.

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

describe('trash clock', () => {
  it('keeps a diagram for 30 days', () => {
    expect(TRASH_RETENTION_MS).toBe(30 * DAY);
    expect(trashPurgeDueAt(T0)).toBe(T0 + 30 * DAY);
  });

  it('shows 30 days left the moment a diagram is deleted', () => {
    expect(trashDaysLeft(T0, T0)).toBe(30);
    expect(trashDaysLeft(T0, T0 + 1)).toBe(30);
  });

  it('rounds a part day up', () => {
    expect(trashDaysLeft(T0, T0 + DAY)).toBe(29);
    expect(trashDaysLeft(T0, T0 + 29 * DAY + 1)).toBe(1);
  });

  it('never shows fewer than zero days', () => {
    expect(trashDaysLeft(T0, T0 + 30 * DAY)).toBe(0);
    expect(trashDaysLeft(T0, T0 + 45 * DAY)).toBe(0);
  });

  it('is expired from the moment the 30 days are up', () => {
    expect(isTrashExpired(T0, T0 + 30 * DAY - 1)).toBe(false);
    expect(isTrashExpired(T0, T0 + 30 * DAY)).toBe(true);
  });
});
