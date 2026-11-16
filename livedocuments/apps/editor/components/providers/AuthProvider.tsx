'use client';

// Deferred auth for the whole app tree (the workbench's components/providers/auth-provider says how), bound to this
// editor's bridges.

import { e2eAuthEnabled } from '@liveworkspace/workbench/lib/auth-config';
import { createAuthProvider } from '@liveworkspace/workbench/components/providers/auth-provider';
import { bindWorkbench } from '@/lib/workbench-bindings';
import { E2E_SESSION_KEY } from '@/lib/workbench-keys';

// This editor's facts for the workbench code, before anything renders (lib/workbench-bindings.ts).
bindWorkbench();

export const AuthProvider = createAuthProvider({
  // Test builds only (see e2eAuthEnabled): never part of a real bundle. It stands in for the accounts
  // bridge, so a test build with sign-in on shows every sign-in surface while the test picks the session.
  loadE2EAuthBridge: e2eAuthEnabled
    ? () =>
        import('@liveworkspace/workbench/components/providers/E2EAuthBridge').then(
          (m) => m.E2EAuthBridge,
        )
    : null,
  loadAccountsBridge: () => import('./AccountsBridge').then((m) => m.AccountsBridge),
  e2eSessionKey: E2E_SESSION_KEY,
});
