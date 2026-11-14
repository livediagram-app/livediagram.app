'use client';

// Deferred auth for the whole app tree (the workbench's components/providers/auth-provider says how), bound to this
// editor's bridges.

import dynamic from 'next/dynamic';
import { e2eAuthEnabled } from '@liveworkspace/workbench/lib/auth-config';
import { createAuthProvider } from '@liveworkspace/workbench/components/providers/auth-provider';
import { bindWorkbench } from '@/lib/workbench-bindings';
import { E2E_SESSION_KEY } from '@/lib/workbench-keys';

// This editor's facts for the workbench code, before anything renders (lib/workbench-bindings.ts).
bindWorkbench();

// Test builds only (see e2eAuthEnabled): never part of a real bundle. It stands in for the accounts
// bridge, so a test build shows every sign-in surface while the test picks the session.
const LazyE2EAuthBridge = e2eAuthEnabled
  ? dynamic(
      () =>
        import('@liveworkspace/workbench/components/providers/E2EAuthBridge').then(
          (m) => m.E2EAuthBridge,
        ),
      {
        ssr: false,
        loading: () => null,
      },
    )
  : null;

const LazyAccountsBridge = dynamic(() => import('./AccountsBridge').then((m) => m.AccountsBridge), {
  ssr: false,
  loading: () => null,
});

export const AuthProvider = createAuthProvider({
  E2EAuthBridge: LazyE2EAuthBridge,
  AccountsBridge: LazyAccountsBridge,
  e2eSessionKey: E2E_SESSION_KEY,
});
