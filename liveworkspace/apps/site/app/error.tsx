'use client';

// A page that throws while rendering (liveworkspace/docs/specs/010-site/site.md "Behaviour"): the site's own card
// inside the root layout, never Next's bare error screen. Try Again renders the page again. The card loads only
// now: this file is in every page's first load (components/LazyPageError.tsx).
import { useEffect } from 'react';
import { LazyPageError } from '@/components/LazyPageError';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[error] the page failed', error);
  }, [error]);
  return <LazyPageError onRetry={reset} />;
}
