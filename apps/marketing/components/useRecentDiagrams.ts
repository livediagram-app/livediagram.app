'use client';

import {
  RECENT_DIAGRAMS_KEY,
  RECENT_THUMBS_CACHE,
  parseRecentDiagrams,
  recentThumbPath,
  scalableSnapshotSvg,
  svgBackgroundColor,
  type RecentDiagram,
} from '@livediagram/api-schema';
import { useEffect, useState } from 'react';

// The landing page's half of the returning visitor (docs/specs/019-marketing/returning-visitor.md): the
// note the editor leaves in this browser, and each noted diagram's snapshot from Cache Storage. Read
// after hydration only (the static HTML is the overview for everyone), and never from the network.

// The visitor's recent diagrams: null until read (and for a new visitor, or anywhere storage is
// blocked), so the overview stays. A returning visitor is one with at least one.
export function useRecentDiagrams(): RecentDiagram[] | null {
  const [diagrams, setDiagrams] = useState<RecentDiagram[] | null>(null);
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(RECENT_DIAGRAMS_KEY);
    } catch {
      // Storage blocked (a private window, site data off): a new visitor, then.
    }
    const read = parseRecentDiagrams(raw);
    // Reading browser storage is the one thing this effect is for; it cannot happen in render, since
    // the static HTML has to match for everyone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (read.length > 0) setDiagrams(read);
    else document.documentElement.removeAttribute('data-returning');
  }, []);
  return diagrams;
}

export type RecentThumb =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'ready'; url: string; backgroundColor: string | null };

// One diagram's snapshot, as a blob URL for an <img> (an SVG image runs no script), with its background
// colour for the letterbox; 'none' when the cache has nothing usable for this save.
export function useRecentThumb(id: string, savedAt: number): RecentThumb {
  const [thumb, setThumb] = useState<RecentThumb>({ status: 'loading' });
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    void (async () => {
      if (!('caches' in window)) return setThumb({ status: 'none' });
      const cache = await caches.open(RECENT_THUMBS_CACHE);
      const res = await cache.match(new URL(recentThumbPath(id, savedAt), location.origin).href);
      if (!res?.ok) return !cancelled && setThumb({ status: 'none' });
      const svg = scalableSnapshotSvg(await res.text());
      if (cancelled) return;
      url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      setThumb({ status: 'ready', url, backgroundColor: svgBackgroundColor(svg) });
    })().catch(() => !cancelled && setThumb({ status: 'none' }));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, savedAt]);
  return thumb;
}
