// The api's half of "access changes end the sessions they affect" (docs/specs/015-api/api.md) for a workbench
// pairing: ask a canvas's room to close the sockets it opened. Best-effort: the pairing's end is the change, and
// every later API call and room join is gated on it, so a room that can't be reached is logged rather than failing
// the request. Every other access change reaches the room through the index (a revoked link's revoke door) or its
// grants (a session's grant is renewed before it lapses, and one the index refuses closes it).

// The closing is @liveworkspace/api-kit's room-access-client.ts; this hands in the room fetch.

import { createRoomAccessClient } from '@liveworkspace/api-kit/room-access-client';
import { roomFetch } from './room-client';

// Read at call time, so a test's mock of ./room-client is the one asked.
export const { closeWorkbenchSessions } = createRoomAccessClient(
  (...args: Parameters<typeof roomFetch>) => roomFetch(...args),
);
