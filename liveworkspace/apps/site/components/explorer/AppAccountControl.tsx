'use client';

// The header's account control for the Explorer shown on an app's own address (lib/explorer/page-app.ts): the app's
// session rather than liveworkspace.app's. Signed in, the same menu as everywhere on the site, its account pages on
// liveworkspace.app and its Sign out the app's (the page reloads as a guest); signed out, the app's own Sign in,
// which comes back here.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { AccountMenu } from '@/components/AccountControl';
import { appAccount, appSignInHref, appSignOut } from '@/lib/explorer/app-session';
import { workspaceHref } from '@/lib/explorer/page-app';

const noChange = () => () => {};

export function AppAccountControl() {
  const [state, setState] = useState<{ name: string } | 'out' | 'checking'>('checking');
  const here = useSyncExternalStore(
    noChange,
    () => window.location.pathname + window.location.search,
    () => '/explorer',
  );
  useEffect(() => {
    let live = true;
    void appAccount().then((found) => live && setState(found ? { name: found.name } : 'out'));
    return () => {
      live = false;
    };
  }, []);

  if (typeof state === 'object')
    return (
      <AccountMenu
        name={state.name}
        pageHref={workspaceHref}
        onSignOut={async () => {
          const left = await appSignOut();
          if (left) window.location.reload();
          return left;
        }}
      />
    );
  return (
    <a
      href={appSignInHref(here)}
      aria-hidden={state === 'checking' || undefined}
      tabIndex={state === 'checking' ? -1 : undefined}
      className={`relative touch-target-y rounded-md border border-slate-200 px-2.5 py-1.5 whitespace-nowrap text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white ${
        state === 'checking' ? 'invisible' : ''
      }`}
    >
      Sign in
    </a>
  );
}
