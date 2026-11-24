import { describe, expect, it, vi } from 'vitest';
import {
  countNotice,
  holdNoticeSlot,
  noticeCount,
  noticeRow,
  noticeSlotHeld,
  onNoticeRow,
  onNoticeSlot,
  registerNoticeRow,
} from './notice-slot';

// liveworkspace/docs/specs/016-notifications/toasts.md "One place for everything that pops up".
describe('the notice slot', () => {
  it('is held while any notice shows, and tells who listens', () => {
    const heard = vi.fn();
    const off = onNoticeSlot(heard);
    expect(noticeSlotHeld()).toBe(false);
    const a = holdNoticeSlot();
    const b = holdNoticeSlot();
    a();
    a();
    expect(noticeSlotHeld()).toBe(true);
    b();
    expect(noticeSlotHeld()).toBe(false);
    expect(heard).toHaveBeenCalledTimes(4);
    off();
    holdNoticeSlot()();
    expect(heard).toHaveBeenCalledTimes(4);
  });
});

describe('the stack’s notice row', () => {
  it('answers the latest registered row, and the one before once it goes', () => {
    const heard = vi.fn();
    const off = onNoticeRow(heard);
    expect(noticeRow()).toBeNull();
    const outer = {} as HTMLElement;
    const inner = {} as HTMLElement;
    const dropOuter = registerNoticeRow(outer);
    const dropInner = registerNoticeRow(inner);
    expect(noticeRow()).toBe(inner);
    dropInner();
    expect(noticeRow()).toBe(outer);
    dropOuter();
    dropOuter();
    expect(noticeRow()).toBeNull();
    expect(heard).toHaveBeenCalledTimes(5);
    off();
  });

  it('counts the notices mounted, each released once', () => {
    expect(noticeCount()).toBe(0);
    const a = countNotice();
    const b = countNotice();
    expect(noticeCount()).toBe(2);
    a();
    a();
    expect(noticeCount()).toBe(1);
    b();
    expect(noticeCount()).toBe(0);
  });
});
