'use client';

// The root layout itself threw (liveworkspace/docs/specs/010-site/site.md "Behaviour"): this stands in for it, so it
// brings its own <html lang>, the stylesheet and the appearance setting (light or dark as the rest of the site).
// Try Again reloads, since the layout that failed is gone. The card loads only now: this file is in every page's
// first load (components/LazyPageError.tsx), so it imports nothing the card or the appearance store would bring.
import { useEffect, useState } from 'react';
import { LazyPageError } from '@/components/LazyPageError';
import './globals.css';

/** Whether the page this replaces was painted dark: the layout's pre-paint script and its Appearance store keep the
 *  `dark` class on <html>, and this first render runs before the page's <html> is replaced. */
function wasDark(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Read once, as it mounts: a copy of the Appearance store here cost every page about 3 KiB gzipped (Work Tracker 772).
  const [dark] = useState(wasDark);
  useEffect(() => {
    console.error('[global-error] the page failed', error);
  }, [error]);
  return (
    <html lang="en-GB" className={dark ? 'dark' : undefined}>
      <body className="bg-slate-50 text-slate-800 antialiased dark:bg-slate-950 dark:text-slate-200">
        <LazyPageError onRetry={() => window.location.reload()} />
      </body>
    </html>
  );
}
