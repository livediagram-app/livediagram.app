'use client';

// Opening an item, ahead (liveworkspace/docs/specs/004-index/one-explorer.md "Cost and performance", Opening an
// item ahead). A pointer resting on an item's link, or focus reaching one, says the person is about to open it: after
// INTENT_DELAY_MS the host is asked to fetch what that open will need (`prefetchItem`, the host's to decide what and
// whether). Bounded so a large grid never fans out: one link waits at a time (moving on cancels it), one prefetch is
// in flight at a time (a newer intent waits for it, replacing any older one still waiting), and each address is asked
// for once per page (PREFETCH_SEEN_MAX, then the record starts again). Never on Save-Data, a slow connection or a
// device with no hovering pointer, and never for a touch: there a press is the open itself.
//
// One pair of listeners on the Explorer's root (pointerover, focusin, with pointerout and focusout to cancel), so no
// row carries a handler and memoised rows keep their props.

import { useEffect, type RefObject } from 'react';

/** How long a pointer rests on a link, or focus stays, before it counts as intent. */
export const INTENT_DELAY_MS = 80;
/** Addresses asked for once per page; past this the record starts again. */
export const PREFETCH_SEEN_MAX = 500;

/** The host's prefetch: a promise that settles once it is done, or null when it fetches nothing for this address
 *  (another site's, not an item's), which then costs nothing and is not counted. */
export type PrefetchItem = (href: string) => Promise<unknown> | null;

type NetworkInformation = { saveData?: boolean; effectiveType?: string };
type Environment = {
  connection?: NetworkInformation | null;
  matchMedia?: ((query: string) => { matches: boolean }) | null;
};

// Slower than these, a prefetch competes with what the person is doing now.
const SLOW = new Set(['slow-2g', '2g', '3g']);

/** Whether this browser should prefetch at all: not with Save-Data on, not on a slow connection, and not on a
 *  touch-only device (no pointer that can hover). Read at each intent, so a change of network is followed. */
export function prefetchAllowed(env: Environment = browserEnvironment()): boolean {
  const connection = env.connection;
  if (connection?.saveData) return false;
  if (connection?.effectiveType && SLOW.has(connection.effectiveType)) return false;
  // `any-hover: hover` is true when any pointer can hover (a mouse or trackpad, a tablet with one attached); a phone
  // or tablet alone answers false. A browser without matchMedia is taken as able to hover.
  const hover = env.matchMedia?.('(any-hover: hover)');
  if (hover && !hover.matches) return false;
  return true;
}

function browserEnvironment(): Environment {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return {};
  return {
    connection: (navigator as Navigator & { connection?: NetworkInformation }).connection ?? null,
    matchMedia: typeof window.matchMedia === 'function' ? (q) => window.matchMedia(q) : null,
  };
}

export type IntentPrefetcher = {
  /** A link is pointed at or focused: prefetch it after the intent delay, unless intent moves on first. */
  intend: (href: string) => void;
  /** Intent left `href` (or anything, without one): its wait is cancelled. A prefetch already started runs on. */
  cancel: (href?: string) => void;
  /** Stops every wait (the Explorer unmounts). */
  dispose: () => void;
};

export function createIntentPrefetcher({
  prefetch,
  allowed = prefetchAllowed,
  delayMs = INTENT_DELAY_MS,
  seenMax = PREFETCH_SEEN_MAX,
}: {
  prefetch: PrefetchItem;
  allowed?: () => boolean;
  delayMs?: number;
  seenMax?: number;
}): IntentPrefetcher {
  const seen = new Set<string>();
  let waiting: { href: string; timer: ReturnType<typeof setTimeout> } | null = null;
  let inFlight = false;
  // The latest intent that came due while another prefetch ran: started once that one settles.
  let next: string | null = null;
  let disposed = false;

  const start = (href: string) => {
    if (disposed || seen.has(href)) return;
    if (inFlight) {
      next = href;
      return;
    }
    let running: Promise<unknown> | null;
    try {
      running = prefetch(href);
    } catch {
      running = null;
    }
    if (!running) return;
    if (seen.size >= seenMax) seen.clear();
    seen.add(href);
    inFlight = true;
    const settled = () => {
      inFlight = false;
      const queued = next;
      next = null;
      if (queued) start(queued);
    };
    running.then(settled, settled);
  };

  const cancel = (href?: string) => {
    if (!waiting || (href !== undefined && waiting.href !== href)) return;
    clearTimeout(waiting.timer);
    waiting = null;
  };

  return {
    intend(href) {
      if (disposed || seen.has(href) || waiting?.href === href) return;
      cancel();
      if (!allowed()) return;
      waiting = {
        href,
        timer: setTimeout(() => {
          waiting = null;
          start(href);
        }, delayMs),
      };
    },
    cancel,
    dispose() {
      disposed = true;
      cancel();
      next = null;
    },
  };
}

// The address a link event is about: an <a href> inside the root, never one inside a field being typed in.
function linkOf(target: EventTarget | null, root: HTMLElement): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  const a = target.closest('a[href]');
  if (!(a instanceof HTMLAnchorElement) || !root.contains(a)) return null;
  return a;
}

/** Listens on `root` for intent on any item link inside it and hands it to `prefetch` (see the file's head). */
export function useIntentPrefetch(
  root: RefObject<HTMLElement | null>,
  prefetch: PrefetchItem | undefined,
): void {
  useEffect(() => {
    const el = root.current;
    if (!el || !prefetch) return;
    const prefetcher = createIntentPrefetcher({ prefetch });
    const over = (e: PointerEvent) => {
      // A touch is the open itself; prefetching then only adds a request.
      if (e.pointerType === 'touch') return;
      const a = linkOf(e.target, el);
      if (a) prefetcher.intend(a.href);
    };
    const out = (e: PointerEvent) => {
      const a = linkOf(e.target, el);
      if (!a) return;
      // Still inside the same link (moving between its children): intent stays.
      if (e.relatedTarget instanceof Node && a.contains(e.relatedTarget)) return;
      prefetcher.cancel(a.href);
    };
    const focus = (e: FocusEvent) => {
      const a = linkOf(e.target, el);
      if (a) prefetcher.intend(a.href);
    };
    const blur = (e: FocusEvent) => {
      const a = linkOf(e.target, el);
      if (a) prefetcher.cancel(a.href);
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
      prefetcher.dispose();
    };
  }, [root, prefetch]);
}
