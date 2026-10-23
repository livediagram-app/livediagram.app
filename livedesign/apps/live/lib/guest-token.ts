// A guest's identity is liveworkspace's, the same guest in every app (liveworkspace/docs/one-explorer-contracts.md
// "Guests"): livedesign's settings for the shared handoff (`@liveworkspace/index-client/browser`). The token is kept
// under GUEST_TOKEN_STORAGE_KEY and sent as the Bearer, exactly as an account's access token is.
import { createGuestTokens } from '@liveworkspace/index-client/browser';
import { API_BASE } from './api/base';
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
  sessionPrefix: 'livedesign',
  apiBase: API_BASE,
  fallbackPath: '/explorer',
  // A guest this browser has never had: the daily new-visitors signal (docs/specs/017-telemetry/telemetry.md).
  onNewGuest: () => reportParticipantCreated(),
});
