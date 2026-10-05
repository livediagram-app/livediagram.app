'use client';

import { useEffect, useEffectEvent, useRef } from 'react';

// `?copy=1` on a share URL (docs/specs/025-community/community.md "Post": Make a Copy opens the
// document in the editor and copies it in one step). Once the shared document has hydrated with a
// share code to copy through, the copy runs exactly once and the parameter leaves the address bar, so a
// reload or Back never copies a second time. An owner (no session share code) only loses the
// parameter: their own document has nothing to copy.

export const AUTO_COPY_PARAM = 'copy';

export function hasAutoCopyParam(search: string): boolean {
  return new URLSearchParams(search).get(AUTO_COPY_PARAM) === '1';
}

// The same URL without the parameter (path, other query and hash kept).
export function withoutAutoCopyParam(href: string): string {
  const url = new URL(href);
  url.searchParams.delete(AUTO_COPY_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function useAutoCopyParam(opts: {
  hydrated: boolean;
  // The code the visitor came in on; null for an owner.
  sessionShareCode: string | null;
  makeCopy: () => void | Promise<void>;
}): void {
  const { hydrated, sessionShareCode, makeCopy } = opts;
  const done = useRef(false);
  const copy = useEffectEvent(() => void makeCopy());

  useEffect(() => {
    if (done.current || !hydrated || typeof window === 'undefined') return;
    if (!hasAutoCopyParam(window.location.search)) return;
    done.current = true;
    window.history.replaceState(
      window.history.state,
      '',
      withoutAutoCopyParam(window.location.href),
    );
    if (sessionShareCode) copy();
  }, [hydrated, sessionShareCode]);
}
