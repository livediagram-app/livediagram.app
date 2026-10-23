'use client';

// A gallery tile's picture: its bytes asked of the host (a browser can't send the person's credentials from an
// <img>), once its tile nears the screen, at most BLOB_CONCURRENCY at a time across the page, as an object URL
// revoked when the tile goes. A gallery of hundreds asks only for what is looked at.

import { useEffect, useRef, useState } from 'react';

export const BLOB_CONCURRENCY = 4;
const ROOT_MARGIN = '200px';

let running = 0;
const waiting: (() => void)[] = [];

function slot(): Promise<void> {
  if (running < BLOB_CONCURRENCY) {
    running++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waiting.push(resolve)).then(() => {
    running++;
  });
}

function release() {
  running--;
  waiting.shift()?.();
}

export type BlobState = { status: 'loading' } | { status: 'ready'; src: string } | { status: 'broken' };

/** The tile's picture, read once `ref`'s element nears the screen (at once where there is no IntersectionObserver). */
export function useBlobUrl<T extends Element>(
  key: string,
  load: (signal: AbortSignal) => Promise<Blob | null>,
): { ref: (el: T | null) => void; state: BlobState } {
  const [state, setState] = useState<BlobState>({ status: 'loading' });
  const [near, setNear] = useState(false);
  const loadRef = useRef(load);
  loadRef.current = load;
  const observer = useRef<IntersectionObserver | null>(null);
  const ref = (el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const seen = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          seen.disconnect();
          setNear(true);
        }
      },
      { rootMargin: ROOT_MARGIN },
    );
    seen.observe(el);
    observer.current = seen;
  };
  useEffect(() => () => observer.current?.disconnect(), []);
  useEffect(() => {
    if (!near) return;
    const controller = new AbortController();
    let url: string | null = null;
    void slot().then(async () => {
      try {
        if (controller.signal.aborted) return;
        const blob = await loadRef.current(controller.signal);
        if (controller.signal.aborted) return;
        if (!blob) {
          setState({ status: 'broken' });
          return;
        }
        url = URL.createObjectURL(blob);
        setState({ status: 'ready', src: url });
      } catch {
        if (!controller.signal.aborted) setState({ status: 'broken' });
      } finally {
        release();
      }
    });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [near, key]);
  return { ref, state };
}
