'use client';

// Card pictures as an element shows them (docs/specs/026-plan/item-types.md "Image fields", items.md "Attachments"):
// the picture's URL at the size it is drawn, fetched only once the element is near the screen, through the cached,
// authenticated read (apiImageUrl), so a picture shown on a board and in its panel is fetched once per size.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { apiImageUrl, releaseImageUrl, type ImagesScope } from '@/lib/api/images';

export type Shown = { state: 'loading' } | { state: 'shown'; url: string } | { state: 'missing' };

const MISSING: Shown = { state: 'missing' };
const LOADING: Shown = { state: 'loading' };

// The picture `imageId` as a URL to show, at most `maxEdge` on its longest side; fetched only while `enabled` (a card
// face waits until it scrolls into view), and given back when it changes or the element goes.
export function useImageUrl(
  scope: ImagesScope | null | undefined,
  imageId: string | null,
  maxEdge?: number,
  enabled = true,
): Shown {
  // What was fetched, for which picture: a different picture reads as loading until its own answer comes.
  const key = scope && imageId ? `${scope.projectId}/${imageId}@${maxEdge ?? ''}` : null;
  const [got, setGot] = useState<{ key: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!key || !scope || !imageId || !enabled) return;
    let live = true;
    let url: string | null = null;
    void apiImageUrl(scope, imageId, maxEdge === undefined ? {} : { maxEdge }).then((u) => {
      url = u;
      if (!live) {
        if (u) releaseImageUrl(u);
        return;
      }
      setGot({ key, url: u });
    });
    return () => {
      live = false;
      if (url) releaseImageUrl(url);
    };
  }, [key, scope, imageId, maxEdge, enabled]);
  if (!scope) return MISSING;
  if (!got || got.key !== key) return LOADING;
  return got.url ? { state: 'shown', url: got.url } : MISSING;
}

// Whether the element has come near the screen yet (and stays true after): a card's picture is fetched only then.
// Without an IntersectionObserver (an old browser) it is true at once.
export function useSeen<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver !== 'function');
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      // A little ahead of the scroll, so a picture is there as its card arrives.
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}
