import { useCallback, useRef } from 'react';
import { ROOM_FULL_MESSAGE, ROOM_MAX_CONNECTIONS } from '@liveplanner/api-schema';

// What the editor says when the plan's room is full (docs/specs/015-api/api.md "A room holds 100 connections"): the
// room's own words, shared by every product (ROOM_FULL_MESSAGE), then why and that nothing is lost.
export const ROOM_FULL_NOTICE = `${ROOM_FULL_MESSAGE}. ${ROOM_MAX_CONNECTIONS} people are in this plan already. Your changes still save, and you’ll join as soon as someone leaves.`;

// Says the room is full once, however many times the connector is turned away while it waits for a seat, and
// again only after it has joined and been turned away afresh.
export function useRoomFullNotice(warn: (message: string) => void) {
  const noticed = useRef(false);
  const noticeFull = useCallback(() => {
    if (noticed.current) return;
    noticed.current = true;
    warn(ROOM_FULL_NOTICE);
  }, [warn]);
  const joined = useCallback(() => {
    noticed.current = false;
  }, []);
  return { noticeFull, joined };
}
