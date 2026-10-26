// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ROOM_FULL_NOTICE, useRoomFullNotice } from './useRoomFullNotice';

// docs/specs/015-api/api.md "A room holds 100 connections": said once while the editor waits for a seat.
describe('useRoomFullNotice', () => {
  it('warns once per wait, and again after joining and being turned away afresh', () => {
    const warn = vi.fn();
    const { result } = renderHook(() => useRoomFullNotice(warn));
    result.current.noticeFull();
    result.current.noticeFull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(ROOM_FULL_NOTICE);
    expect(ROOM_FULL_NOTICE).toMatch(/^This room is full\. 100 people/);
    result.current.joined();
    result.current.noticeFull();
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
