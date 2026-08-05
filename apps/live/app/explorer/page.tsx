'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// /explorer is an index with no content of its own: every section
// lives at /explorer/<section> (spec/15, routes.ts). Default landing
// is the Timeline (spec/138 §8.1) — what has HAPPENED, rather than a
// list of files. In production the live worker 302s this path before
// any HTML is served (src/worker.ts); this client replace is the
// dev-server / direct-asset fallback. Both, plus selectedFromRoute's
// default case, have to agree on the landing section.
export default function ExplorerIndexRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/explorer/timeline');
  }, [router]);
  return null;
}
