'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Whether a website embed's frame has failed to load (spec/133).
//
// READ THIS BEFORE "improving" the detection. A site that refuses framing via
// `X-Frame-Options: DENY` or CSP `frame-ancestors` is NOT distinguishable from
// a site that loaded perfectly. Measured in Chrome against bbc.co.uk (which
// sends both headers) versus example.com (which sends neither), every
// available signal is identical:
//
//   | signal                        | example.com | bbc.co.uk |
//   | load event                    | fires       | fires     |
//   | error event                   | no          | no        |
//   | contentWindow.location.href   | throws      | throws    |
//   | contentDocument               | null        | null      |
//   | contentWindow.origin          | throws      | throws    |
//   | contentWindow.length          | 0           | 0         |
//   | resource timing entry         | present     | present   |
//
// Chrome serves its refusal page as a cross-origin document, so the classic
// "read location.href and see about:blank" trick reports success for both. An
// earlier version of this hook used exactly that, backed by a timeout, and the
// timeout is what actually fired: every website embed grew a "won't load"
// notice eight seconds after loading fine.
//
// So this hook claims only what it can prove: the frame produced NO load event
// at all within the window. That catches a genuinely hung or unreachable site.
// A refusal is covered instead by the always-available "Open in a new tab"
// control on a website embed, which is honest about being an escape hatch
// rather than a diagnosis.

/** How long to wait for any load signal before calling the frame dead. */
const LOAD_TIMEOUT_MS = 8000;

export function useFrameBlocked(src: string | undefined): {
  ref: React.RefObject<HTMLIFrameElement | null>;
  /** The frame never loaded. NOT "the site refused to be framed" — see above. */
  failed: boolean;
  onLoad: () => void;
  /** Clears the verdict so a retry starts from scratch. */
  reset: () => void;
} {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [failed, setFailed] = useState(false);
  // The pending backstop, in a ref so `onLoad` can cancel it. Without that
  // cancel it fires on every embed regardless of outcome.
  const timer = useRef<number | null>(null);

  // A new URL is a new question: whatever we concluded about the last one
  // says nothing about this one.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  useEffect(() => {
    if (!src) return;
    const id = window.setTimeout(() => setFailed(true), LOAD_TIMEOUT_MS);
    timer.current = id;
    return () => {
      window.clearTimeout(id);
      timer.current = null;
    };
  }, [src]);

  const onLoad = useCallback(() => {
    // Any load event settles it: the frame is alive, whatever it is showing.
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setFailed(false);
  }, []);

  const reset = useCallback(() => setFailed(false), []);

  return { ref, failed, onLoad, reset };
}
