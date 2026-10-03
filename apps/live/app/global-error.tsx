'use client';

// The app's root error boundary (docs/specs/016-platform/stale-builds.md "The safety net"): a chunk
// from an earlier build that failed to load becomes a full page load of where the user was going;
// anything else, or a second failure inside the loop guard's window, shows this calm page in the
// app's own look instead of the framework's.
import { useEffect } from 'react';
import { Button } from '@livediagram/ui';
import { browserNavigationDeps, recoverInBrowser } from '@/lib/stale-build-navigation';
import './globals.css';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error] the page failed', error);
    void recoverInBrowser(error, browserNavigationDeps());
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-800 antialiased dark:bg-slate-950 dark:text-slate-100">
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-lg font-semibold">This page couldn&apos;t load</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">Reload to try again.</p>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </main>
      </body>
    </html>
  );
}
