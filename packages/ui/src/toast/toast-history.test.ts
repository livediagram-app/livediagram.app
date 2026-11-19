// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TOAST_HISTORY_LIMIT,
  TOAST_HISTORY_MERGE_MS,
  TOAST_HISTORY_SCOPES,
  clearToastHistory,
  currentToastHistoryScope,
  hasMissedToast,
  markToastHistorySeen,
  parseToastRecords,
  readToastHistory,
  recordToast,
  resetToastHistoryForTests,
  setToastHistoryScope,
  settleToast,
  subscribeToastHistory,
  touchScopeIndex,
  forgetToast,
} from './toast-history';

// liveworkspace/docs/specs/016-notifications/toasts.md "What is kept" and "The footer button".

afterEach(() => {
  resetToastHistoryForTests();
  localStorage.clear();
});

const toast = (id: string, message = `Toast ${id}`, key?: string) => ({
  id,
  tone: 'info' as const,
  message,
  key,
});

describe('the notification list', () => {
  it('keeps each document’s list apart, by the page’s path unless a scope is named', () => {
    window.history.replaceState(null, '', '/document/a');
    recordToast(toast('1'), 'live');
    window.history.replaceState(null, '', '/document/b');
    expect(readToastHistory()).toEqual([]);
    recordToast(toast('2'), 'live');
    expect(readToastHistory('/document/a').map((r) => r.id)).toEqual(['1']);
    setToastHistoryScope(() => 'explorer');
    expect(currentToastHistoryScope()).toBe('explorer');
    expect(readToastHistory()).toEqual([]);
    setToastHistoryScope(null);
    expect(currentToastHistoryScope()).toBe('/document/b');
  });

  it('survives a reload: a toast still up when the page went counts as missed', () => {
    setToastHistoryScope(() => 's');
    recordToast(toast('1'), 'live');
    resetToastHistoryForTests();
    setToastHistoryScope(() => 's');
    const [record] = readToastHistory();
    expect(record).toMatchObject({ id: '1', message: 'Toast 1', state: 'missed' });
  });

  it('updates a toast upserted in place to its final words, once', () => {
    setToastHistoryScope(() => 's');
    recordToast(toast('1', 'Webber changed 1 element'), 'live');
    recordToast(toast('1', 'Webber changed 3 elements'), 'live');
    expect(readToastHistory().map((r) => r.message)).toEqual(['Webber changed 3 elements']);
  });

  it('folds a muted burst under one key into one record while it is recent', () => {
    setToastHistoryScope(() => 's');
    recordToast(toast('1', 'one', 'k'), 'missed', 1_000);
    recordToast(toast('2', 'two', 'k'), 'missed', 2_000);
    expect(readToastHistory().map((r) => r.message)).toEqual(['two']);
    recordToast(toast('3', 'three', 'k'), 'missed', 1_000 + TOAST_HISTORY_MERGE_MS);
    expect(readToastHistory().map((r) => r.message)).toEqual(['two', 'three']);
  });

  it(`keeps the last ${TOAST_HISTORY_LIMIT}`, () => {
    setToastHistoryScope(() => 's');
    for (let i = 0; i < TOAST_HISTORY_LIMIT + 5; i++) recordToast(toast(String(i)), 'live');
    const list = readToastHistory();
    expect(list).toHaveLength(TOAST_HISTORY_LIMIT);
    expect(list[0]!.id).toBe('5');
  });

  it(`keeps at most ${TOAST_HISTORY_SCOPES} lists, forgetting the one written longest ago`, () => {
    for (let i = 0; i <= TOAST_HISTORY_SCOPES; i++) {
      setToastHistoryScope(() => `doc-${i}`);
      recordToast(toast(String(i)), 'live');
    }
    expect(localStorage.getItem('liveworkspace:toasts:doc-0')).toBeNull();
    expect(localStorage.getItem('liveworkspace:toasts:doc-1')).not.toBeNull();
    resetToastHistoryForTests();
    expect(readToastHistory('doc-0')).toEqual([]);
    expect(touchScopeIndex(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
  });

  it('settles a live toast as seen or missed, and opening the list sees the missed', () => {
    setToastHistoryScope(() => 's');
    recordToast(toast('1'), 'live');
    recordToast(toast('2'), 'live');
    settleToast('1', 'seen');
    settleToast('2', 'missed');
    // Only a live one changes.
    settleToast('1', 'missed');
    expect(readToastHistory().map((r) => r.state)).toEqual(['seen', 'missed']);
    expect(hasMissedToast(readToastHistory())).toBe(true);
    markToastHistorySeen();
    expect(hasMissedToast(readToastHistory())).toBe(false);
    settleToast('nope', 'seen');
  });

  it('tells its subscribers, and Clear empties the list', () => {
    setToastHistoryScope(() => 's');
    const heard = vi.fn();
    const stop = subscribeToastHistory(heard);
    recordToast(toast('1'), 'live');
    expect(heard).toHaveBeenCalled();
    clearToastHistory();
    expect(readToastHistory()).toEqual([]);
    expect(localStorage.getItem('liveworkspace:toasts:s')).toBeNull();
    heard.mockClear();
    clearToastHistory();
    markToastHistorySeen();
    expect(heard).not.toHaveBeenCalled();
    stop();
  });

  it('reads only well-formed records back', () => {
    expect(parseToastRecords(null)).toEqual([]);
    expect(parseToastRecords('not json')).toEqual([]);
    expect(parseToastRecords('{"a":1}')).toEqual([]);
    const good = { id: '1', tone: 'error', message: 'm', at: 1, state: 'seen' };
    expect(
      parseToastRecords(
        JSON.stringify([good, { ...good, tone: 'loud' }, { ...good, key: 3 }, null]),
      ),
    ).toEqual([good]);
  });

  it('still works when storage refuses', () => {
    setToastHistoryScope(() => 's');
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    recordToast(toast('1'), 'live');
    expect(readToastHistory()).toHaveLength(1);
    set.mockRestore();
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readToastHistory('other')).toEqual([]);
    get.mockRestore();
  });

  it('a stored index that is not a list is started again', () => {
    localStorage.setItem('liveworkspace:toasts:index', '"x"');
    setToastHistoryScope(() => 's');
    recordToast(toast('1'), 'live');
    expect(JSON.parse(localStorage.getItem('liveworkspace:toasts:index')!)).toEqual(['s']);
    localStorage.setItem('liveworkspace:toasts:index', '{bad');
    recordToast(toast('2'), 'live');
    expect(JSON.parse(localStorage.getItem('liveworkspace:toasts:index')!)).toEqual(['s']);
  });

  it('forgets a closed toast, and leaves the list alone for an unknown id', () => {
    recordToast({ id: 'a', tone: 'info', message: 'Kept' }, 'live');
    recordToast({ id: 'b', tone: 'info', message: 'Closed' }, 'live');
    forgetToast('b');
    expect(readToastHistory().map((r) => r.message)).toEqual(['Kept']);
    forgetToast('nope');
    expect(readToastHistory().map((r) => r.message)).toEqual(['Kept']);
  });
});
