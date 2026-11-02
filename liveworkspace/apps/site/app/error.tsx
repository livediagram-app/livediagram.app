'use client';

// A page that throws while rendering (liveworkspace/docs/specs/010-site/site.md "Behaviour"): the site's own card
// inside the root layout, never Next's bare error screen. Try Again renders the page again.
import { useEffect } from 'react';
import { PageError } from '@/components/PageError';

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
  return <PageError onRetry={reset} />;
}
