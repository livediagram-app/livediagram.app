'use client';

// The token cap's list (TokenLimitList), fetched only when a Connect meets the cap: few connects ever do, so the
// consent and device pages carry none of Settings' token rows until then. The fallback is the list's own loading
// shape, so nothing jumps when it lands.
import { lazy, Suspense } from 'react';

const TokenLimitList = lazy(() =>
  import('./TokenLimitList').then((m) => ({ default: m.TokenLimitList })),
);

export function TokenLimitListLazy({ onFreed }: { onFreed: () => void }) {
  return (
    <Suspense
      fallback={
        <div
          aria-busy
          aria-label="Loading your tokens"
          className="mt-3 h-36 animate-pulse rounded-lg bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800/70"
        />
      }
    >
      <TokenLimitList onFreed={onFreed} />
    </Suspense>
  );
}
