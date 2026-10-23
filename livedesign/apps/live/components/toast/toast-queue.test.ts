import { describe, expect, it, vi } from 'vitest';
import {
  TOAST_LIMIT,
  TOAST_TIMEOUT_MS,
  pushToast,
  retireToasts,
  toastTimeout,
  toastAnswers,
  TOAST_ANSWER_TIMEOUT_MS,
  upsertActionToast,
  type ToastEntry,
} from './toast-queue';

// docs/specs/004-interface-design/toasts.md "Kinds of toast" and "Timing".
const undo = { label: 'Undo', onSelect: vi.fn() };
const live = (list: ToastEntry[]) => list.filter((t) => !t.leaving).map((t) => t.message);

describe('pushToast', () => {
  it('adds a toast, and ignores an empty message', () => {
    const one = pushToast([], { message: 'Saved', tone: 'success' }, 1);
    expect(one).toEqual([{ id: 1, message: 'Saved', tone: 'success' }]);
    expect(pushToast(one, { message: '', tone: 'error' }, 2)).toBe(one);
  });

  it('shows the same tone and message once while it is up, but again once it is leaving', () => {
    const one = pushToast([], { message: 'Saved', tone: 'success' }, 1);
    expect(pushToast(one, { message: 'Saved', tone: 'success' }, 2)).toBe(one);
    expect(pushToast(one, { message: 'Saved', tone: 'info' }, 2)).toHaveLength(2);
    const leaving = retireToasts(one, () => true);
    expect(live(pushToast(leaving, { message: 'Saved', tone: 'success' }, 2))).toEqual(['Saved']);
  });

  it(`keeps at most ${TOAST_LIMIT} up, retiring the oldest without answers before any with them`, () => {
    let list = upsertActionToast([], { key: 'd', message: 'Design deleted', actions: [undo] }, 1);
    for (let i = 2; i <= TOAST_LIMIT + 1; i++) {
      list = pushToast(list, { message: `Note ${i}`, tone: 'info' }, i);
    }
    expect(live(list)).toEqual(['Design deleted', 'Note 3', 'Note 4']);
  });

  it('retires the oldest of all when every toast has answers', () => {
    let list: ToastEntry[] = [];
    for (let i = 1; i <= TOAST_LIMIT + 1; i++) {
      list = upsertActionToast(list, { key: `k${i}`, message: `Deleted ${i}`, actions: [undo] }, i);
    }
    expect(live(list)).toEqual(['Deleted 2', 'Deleted 3', 'Deleted 4']);
  });
});

describe('a full stack', () => {
  it('shows at most three toasts, so a burst never covers the screen', () => {
    expect(TOAST_LIMIT).toBe(3);
  });

  it('marks a toast that retired an older one as arriving on a full stack, and only that one', () => {
    let list: ToastEntry[] = [];
    for (let i = 1; i <= TOAST_LIMIT; i++) {
      list = upsertActionToast(list, { key: `k${i}`, message: `Deleted ${i}`, actions: [undo] }, i);
    }
    expect(list.some((t) => t.full)).toBe(false);
    list = upsertActionToast(list, { key: 'k9', message: 'Deleted 9', actions: [undo] }, 9);
    expect(list.filter((t) => t.full).map((t) => t.id)).toEqual([9]);
    list = pushToast(list, { message: 'Saved', tone: 'success' }, 10);
    expect(list.find((t) => t.id === 10)?.full).toBe(true);
  });

  it('marks nothing when a toast replaces one under its key, or the stack has room', () => {
    let list = upsertActionToast([], { key: 'a', message: 'Deleted 1', actions: [undo] }, 1);
    list = upsertActionToast(list, { key: 'a', message: 'Deleted 2', actions: [undo] }, 2);
    list = pushToast(list, { message: 'Saved', tone: 'success' }, 3);
    expect(list.some((t) => t.full)).toBe(false);
  });
});

describe('upsertActionToast', () => {
  it('replaces the toast under the same key in place, keeping its id', () => {
    let list = upsertActionToast(
      [],
      { key: 'a', message: 'Webber changed 1 element', actions: [undo] },
      1,
    );
    list = pushToast(list, { message: 'Saved', tone: 'success' }, 2);
    list = upsertActionToast(
      list,
      { key: 'a', message: 'Webber changed 4 elements', actions: [undo] },
      3,
    );
    expect(list.map((t) => [t.id, t.message])).toEqual([
      [1, 'Webber changed 4 elements'],
      [2, 'Saved'],
    ]);
  });

  it('ignores an empty message', () => {
    expect(upsertActionToast([], { key: 'a', message: '', actions: [] }, 1)).toEqual([]);
  });
});

describe('retireToasts', () => {
  it('marks the matches leaving, and returns the same list when nothing matches', () => {
    const list = pushToast([], { message: 'Saved', tone: 'success' }, 1);
    expect(retireToasts(list, (t) => t.id === 9)).toBe(list);
    expect(retireToasts(list, (t) => t.id === 1)[0]!.leaving).toBe(true);
  });
});

describe('toastAnswers / toastTimeout', () => {
  it('gives an offer or an action toast with a button the longer answer time; times out by tone otherwise', () => {
    const offer = {
      message: 'm',
      confirmLabel: 'Try It',
      declineLabel: 'No Thanks',
      onConfirm() {},
      onDecline() {},
    };
    expect(toastAnswers({ offer })).toBe(true);
    expect(toastAnswers({ actions: [undo] })).toBe(true);
    expect(toastAnswers({ actions: [] })).toBe(false);
    expect(toastTimeout({ tone: 'info', actions: [undo] })).toBe(TOAST_ANSWER_TIMEOUT_MS);
    expect(toastTimeout({ tone: 'info', offer })).toBe(TOAST_ANSWER_TIMEOUT_MS);
    expect(toastTimeout({ tone: 'info', actions: [] })).toBe(TOAST_TIMEOUT_MS.info);
    expect(toastTimeout({ tone: 'warning' })).toBe(TOAST_TIMEOUT_MS.warning);
    expect(TOAST_TIMEOUT_MS).toEqual({ info: 4000, success: 4000, warning: 6000, error: 6000 });
    expect(TOAST_ANSWER_TIMEOUT_MS).toBe(10_000);
  });
});
