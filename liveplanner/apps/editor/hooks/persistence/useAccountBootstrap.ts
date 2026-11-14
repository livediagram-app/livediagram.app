'use client';

import { createUseAccountBootstrap } from '@liveworkspace/workbench/hooks/persistence/useAccountBootstrap';
import { useWorkbenchSession } from '@/components/providers/workbench-session-context';
import { registerTokenProvider } from '@/lib/api-client';
import { clearGuestToken } from '@/lib/guest-token';
import { inboxSnapshot } from '@/lib/offline/inbox-snapshot';

// The account's token provider, the spent guest token and the Inbox snapshot's owner, once a session can exist
// (docs/specs/014-identity/auth-and-guest-access.md), bound to this editor's api client and stores.
export const useAccountBootstrap = createUseAccountBootstrap({
  useWorkbenchSession,
  // Read at call time, so a test that mocks one of these modules in part still loads this one.
  registerTokenProvider: (provider) => registerTokenProvider(provider),
  clearGuestToken: () => clearGuestToken(),
  inboxSnapshot: { setAccount: (id) => inboxSnapshot.setAccount(id) },
});
