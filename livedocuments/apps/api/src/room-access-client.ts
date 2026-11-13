// The api's half of "access changes end the sessions they affect" (docs/specs/015-api/api.md): ask
// a document's room to close the sessions an access change no longer admits (a workbench pairing ended).
// Best-effort: every later API call and room join is gated on the change, so a room that can't be reached is
// logged rather than failing the request. Sharing and team changes are the index's: it tells the room itself
// (`/api/internal/items/:id/revoke`), and a removed member's grant lapses within ten minutes.

// The closing is @liveworkspace/api-kit's room-access-client.ts; this hands in the room fetch.

import { createRoomAccessClient } from '@liveworkspace/api-kit/room-access-client';
import { roomFetch } from './room-client';

// Read at call time, so a test's mock of ./room-client is the one asked.
export const { closeWorkbenchSessions } = createRoomAccessClient(
  (...args: Parameters<typeof roomFetch>) => roomFetch(...args),
);
