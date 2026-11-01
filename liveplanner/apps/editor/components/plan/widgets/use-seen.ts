'use client';

// Whether a widget gallery tile has come into view (docs/specs/026-plan/board-widgets.md "Previews are drawn as they
// come into view"): one IntersectionObserver for the whole gallery list, so a tile draws its live preview (and works
// out its widget) only once it is near the visible part of the list, and keeps it from then on. Without an
// IntersectionObserver (an old browser, a test) every tile counts as seen.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

type Watch = (el: Element, onSeen: () => void) => () => void;

export const SeenContext = createContext<Watch | null>(null);

// How far past the list's visible edge a tile already counts as seen, so a short scroll finds it drawn.
const SEEN_MARGIN = '160px';

// The watcher the gallery shares with its tiles: one observer rooted on the scrolling list.
export function useSeenRoot(root: RefObject<HTMLElement | null>): Watch | null {
  const callbacks = useRef(new Map<Element, () => void>());
  const observer = useRef<IntersectionObserver | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          callbacks.current.get(e.target)?.();
          callbacks.current.delete(e.target);
          obs.unobserve(e.target);
        }
      },
      { root: root.current, rootMargin: SEEN_MARGIN },
    );
    observer.current = obs;
    // The observer exists only once mounted (it needs the list), so tiles learn of it on the next render.
    // oxlint-disable-next-line react/set-state-in-effect
    setReady(true);
    return () => obs.disconnect();
  }, [root]);
  const watch = useCallback<Watch>((el, onSeen) => {
    callbacks.current.set(el, onSeen);
    observer.current?.observe(el);
    return () => {
      callbacks.current.delete(el);
      observer.current?.unobserve(el);
    };
  }, []);
  return ready ? watch : null;
}

// A tile's own: a ref for its element, and whether it has been seen.
export function useSeen(): [RefObject<HTMLDivElement | null>, boolean] {
  const watch = useContext(SeenContext);
  const ref = useRef<HTMLDivElement>(null);
  const noObserver = typeof IntersectionObserver === 'undefined';
  const [seen, setSeen] = useState(noObserver);
  useEffect(() => {
    if (seen || !watch || !ref.current) return;
    return watch(ref.current, () => setSeen(true));
  }, [seen, watch]);
  return [ref, seen];
}
