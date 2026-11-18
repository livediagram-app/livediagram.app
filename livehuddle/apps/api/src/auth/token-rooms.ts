// A token's rooms (docs/specs/015-api/public-api-and-tokens.md "Revoking a token"): a room ticket minted through an API
// token is noted at liveworkspace until it lapses, so revoking the token closes its sockets at once. livehuddle has no
// workbench sessions, so it takes the noter alone from @liveworkspace/auth-client's workbench-sessions.ts.

import { createTokenRooms } from '@liveworkspace/auth-client/workbench-sessions';
import { accountCredentials } from './accounts';

export const { noteTokenRoom } = createTokenRooms({
  // Read at call time, so a test's mock of ./accounts is the one asked.
  credentials: (env: Parameters<typeof accountCredentials>[0]) => accountCredentials(env),
});
