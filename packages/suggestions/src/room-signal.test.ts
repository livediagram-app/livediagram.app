import { describe, expect, it, vi } from 'vitest';
import {
  onRoomSuggestOnly,
  onSuggestionsChanged,
  roomSuggestOnly,
  setRoomSuggestOnly,
  setSelfSuggesting,
  suggestingNow,
  suggestionsRoomOp,
  takeSuggestionsRoomOp,
} from './room-signal';

describe('room-signal', () => {
  it('hands a suggestions op to every listener', () => {
    const heard = vi.fn();
    const off = onSuggestionsChanged(heard);
    expect(takeSuggestionsRoomOp(suggestionsRoomOp('t1'))).toBe(true);
    expect(heard).toHaveBeenCalledWith('t1');
    off();
    takeSuggestionsRoomOp(suggestionsRoomOp('t2'));
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('takes the review op as this session’s Suggest Only, telling only a change', () => {
    const heard = vi.fn();
    const off = onRoomSuggestOnly(heard);
    expect(takeSuggestionsRoomOp({ kind: 'review', suggestOnly: true })).toBe(true);
    expect(roomSuggestOnly()).toBe(true);
    setRoomSuggestOnly(true);
    expect(heard).toHaveBeenCalledTimes(1);
    setRoomSuggestOnly(false);
    expect(heard).toHaveBeenCalledTimes(2);
    off();
  });

  it('says this session suggests on Suggest Only or in its own Suggesting mode, telling only a change', () => {
    const heard = vi.fn();
    const off = onRoomSuggestOnly(heard);
    setRoomSuggestOnly(false);
    expect(suggestingNow()).toBe(false);
    setSelfSuggesting(true);
    setSelfSuggesting(true);
    expect(suggestingNow()).toBe(true);
    expect(heard).toHaveBeenCalledTimes(1);
    setSelfSuggesting(false);
    setRoomSuggestOnly(true);
    expect(suggestingNow()).toBe(true);
    setRoomSuggestOnly(false);
    expect(suggestingNow()).toBe(false);
    off();
  });

  it('leaves every other op alone', () => {
    expect(takeSuggestionsRoomOp(null)).toBe(false);
    expect(takeSuggestionsRoomOp('x')).toBe(false);
    expect(takeSuggestionsRoomOp({ kind: 'suggestions' })).toBe(false);
    expect(takeSuggestionsRoomOp({ kind: 'review', suggestOnly: 'yes' })).toBe(false);
    expect(takeSuggestionsRoomOp({ kind: 'cursor' })).toBe(false);
  });
});
