'use client';

// The root layout itself threw (liveworkspace/docs/specs/010-site/site.md "Behaviour"): this stands in for it, so it
// brings its own <html lang>, the stylesheet and the appearance setting (light or dark as the rest of the site).
// Try Again reloads, since the layout that failed is gone.
import { useEffect, useLayoutEffect } from 'react';
import { applyAppearance, getResolvedAppearance } from '@livediagram/ui';
import { PageError } from '@/components/PageError';
import './globals.css';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useLayoutEffect(() => applyAppearance(getResolvedAppearance()), []);
  useEffect(() => {
    console.error('[global-error] the page failed', error);
  }, [error]);
  return (
    <html lang="en-GB">
      <body className="bg-slate-50 text-slate-800 antialiased dark:bg-slate-950 dark:text-slate-200">
        <PageError onRetry={() => window.location.reload()} />
      </body>
    </html>
  );
}
