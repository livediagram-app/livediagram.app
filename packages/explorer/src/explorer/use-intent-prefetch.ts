'use client';

// Opening an item, ahead: the Explorer's listeners (intent-prefetch.ts says what counts as intent and how it is
// bounded). One pair on the Explorer's root (pointerover, focusin, with pointerout and focusout to cancel), so no row
// carries a handler and memoised rows keep their props. All this file holds is the listeners: the prefetcher's code
// loads with the first intent, so the Explorer's first load carries none of it (liveworkspace/docs/specs/010-site/
// blueprints/site.md "Performance and limits").

import { useEffect, type RefObject } from 'react';
import type { IntentPrefetcher, PrefetchItem } from './intent-prefetch';

// The address a link event is about: an <a href> inside the root, never one inside a field being typed in.
function linkOf(target: EventTarget | null, root: HTMLElement): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  const a = target.closest('a[href]');
  if (!(a instanceof HTMLAnchorElement) || !root.contains(a)) return null;
  return a;
}

// The prefetcher's code, fetched with the first intent.
const loadPrefetcher = () => import('./intent-prefetch');

/** Listens on `root` for intent on any item link inside it and hands it to `prefetch` (see the file's head). `load`
 *  is for tests. */
export function useIntentPrefetch(
  root: RefObject<HTMLElement | null>,
  prefetch: PrefetchItem | undefined,
  load: () => Promise<
    Pick<typeof import('./intent-prefetch'), 'createIntentPrefetcher'>
  > = loadPrefetcher,
): void {
  useEffect(() => {
    const el = root.current;
    if (!el || !prefetch) return;
    let prefetcher: IntentPrefetcher | null = null;
    let loading = false;
    let disposed = false;
    // The latest intent while the prefetcher's code loads, handed to it once it arrives (unless intent left it).
    let pending: string | null = null;
    const intend = (href: string) => {
      if (prefetcher) return prefetcher.intend(href);
      pending = href;
      if (loading) return;
      loading = true;
      load().then(
        ({ createIntentPrefetcher }) => {
          if (disposed) return;
          prefetcher = createIntentPrefetcher({ prefetch });
          if (pending) prefetcher.intend(pending);
          pending = null;
        },
        () => {
          // The code did not load (offline, a new deploy): the next intent tries again.
          loading = false;
        },
      );
    };
    const cancel = (href: string) => {
      if (prefetcher) prefetcher.cancel(href);
      else if (pending === href) pending = null;
    };
    const over = (e: PointerEvent) => {
      // A touch is the open itself; prefetching then only adds a request.
      if (e.pointerType === 'touch') return;
      const a = linkOf(e.target, el);
      if (a) intend(a.href);
    };
    const out = (e: PointerEvent) => {
      const a = linkOf(e.target, el);
      if (!a) return;
      // Still inside the same link (moving between its children): intent stays.
      if (e.relatedTarget instanceof Node && a.contains(e.relatedTarget)) return;
      cancel(a.href);
    };
    const focus = (e: FocusEvent) => {
      const a = linkOf(e.target, el);
      if (a) intend(a.href);
    };
    const blur = (e: FocusEvent) => {
      const a = linkOf(e.target, el);
      if (a) cancel(a.href);
    };
    el.addEventListener('pointerover', over);
    el.addEventListener('pointerout', out);
    el.addEventListener('focusin', focus);
    el.addEventListener('focusout', blur);
    return () => {
      el.removeEventListener('pointerover', over);
      el.removeEventListener('pointerout', out);
      el.removeEventListener('focusin', focus);
      el.removeEventListener('focusout', blur);
      disposed = true;
      prefetcher?.dispose();
    };
  }, [root, prefetch, load]);
}
