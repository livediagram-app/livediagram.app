// Referentially-stable wrappers for a bundle of event-handler props
// (the "useEvent" pattern). Each returned function keeps the SAME
// identity for the lifetime of the component but always invokes the
// latest underlying callback, so passing them to a React.memo'd child
// lets that child skip re-rendering when only the parent re-rendered
// (e.g. the editor re-rendering on every drag frame) WITHOUT the
// stale-closure risk of memoising the originals by hand.
//
// Only use for true event handlers — functions called in response to a
// user interaction, never during render. The wrappers read the current
// callback through useLatest, updated in an insertion effect, so calling
// one during render could see a stale value before the commit.
//
// The key set must be constant across renders (it always is for a fixed
// prop bundle); the stable wrapper object is built once on first render.

import { useState } from 'react';
import { useLatest } from './useLatest';

type AnyFn = (...args: never[]) => unknown;

// The constraint allows `| undefined` entries so optional handler props
// (e.g. `onRenameCurrent?`) keep their exact signature in the returned
// bundle instead of being widened to AnyFn. The wrappers no-op (via
// optional chaining) when the underlying prop is currently undefined.
export function useStableCallbacks<T extends Record<string, AnyFn | undefined>>(fns: T): T {
  const latest = useLatest(fns);
  const [stable] = useState(() => {
    const wrappers = {} as Record<string, AnyFn>;
    for (const key of Object.keys(fns)) {
      wrappers[key] = (...args: never[]) => latest.current[key]?.(...args);
    }
    return wrappers as T;
  });
  return stable;
}
