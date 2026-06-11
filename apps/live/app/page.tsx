'use client';

import { useLayoutEffect } from 'react';

// Hard cutover (spec/14): `/live` no longer hosts the editor. The
// canonical owner URL is `/diagram/<id>`; `/new` owns the
// welcome / create-new flow. Anyone landing on bare `/live` gets
// redirected to `/new` so they start in the right place.
//
// Visitor `?s=<code>` URLs are exempt — that scheme stays a query
// param because the code is the lookup key, not a path id — so we
// forward those into the editor (which still reads `?s=` via the
// path under `/diagram/placeholder` thanks to the worker rewrite).
export default function LiveIndex() {
  useLayoutEffect(() => {
    const url = new URL(window.location.href);
    const shareCode = url.searchParams.get('s');
    if (shareCode) {
      window.location.replace(`${window.location.origin}/diagram/shared?s=${shareCode}`);
      return;
    }
    window.location.replace(`${window.location.origin}/new`);
  }, []);
  return null;
}
