// A guest's identity is liveworkspace's, the same guest in every app (liveworkspace/docs/one-explorer-contracts.md
// "Guests"): @liveworkspace/index-client/browser's guest tokens, with livedocuments' storage keys and api. The first
// time this browser needs one, it goes to the accounts site through this app's `/api/auth/guest` and comes back to
// /auth/guest with a year-long guest token, kept here and sent as the Bearer, exactly as an account's access token is.

import { createGuestTokens } from '@liveworkspace/index-client/browser';
import { API_BASE } from '@liveworkspace/workbench/lib/api/base';
import { reportParticipantCreated } from './local-identity';
import { GUEST_TOKEN_STORAGE_KEY } from './guest-token-key';

export {
  GUEST_TOKEN_REFRESH_BEFORE_MS,
  guestTokenNeedsRefresh,
  parseGuestToken,
  type GuestToken,
} from '@liveworkspace/index-client/browser';

export const {
  readGuestToken,
  clearGuestToken,
  startGuestHandoff,
  completeGuestHandoff,
  ensureGuestToken,
} = createGuestTokens({
  storageKey: GUEST_TOKEN_STORAGE_KEY,
  sessionPrefix: 'livedocuments',
  apiBase: API_BASE,
  fallbackPath: '/explorer',
  // A guest this browser has never had: the daily new-visitors signal (docs/specs/017-telemetry/telemetry.md).
  onNewGuest: () => reportParticipantCreated(),
});
