// The api's half of "access changes end the sessions they affect" (a revoked API token's sockets,
// docs/specs/015-api/public-api-and-tokens.md "Revoking a token") and of a trash reaching open rooms
// (docs/specs/013-workspace/trash.md "Open editors"): the calls are @liveworkspace/api-kit's room-access-client.ts;
// this hands in the room fetch.

import { createRoomAccessClient } from '@liveworkspace/api-kit/room-access-client';
import { roomFetch } from './room-client';

// Read at call time, so a test's mock of ./room-client is the one asked.
export const { closeTokenSessions, tellTrashed } = createRoomAccessClient(
  (...args: Parameters<typeof roomFetch>) => roomFetch(...args),
);
