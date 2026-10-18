'use client';

// The Night Band frame's lines (docs/specs/014-identity/auth-and-guest-access.md "The look: Night Band"): four slots,
// each drawing a random edge-to-edge route that draws in, holds, then trails off the far edge; when a route finishes
// its slot takes a fresh one, so new lines keep coming from every direction. The motion lives in auth-motion.css.
// Routes are chosen after mount (a static export renders the same page for everyone, so a random route on the server
// would never match the browser's). Decorative: hidden from assistive technology and absent below lg. Under reduced
// motion the moving routes are hidden and two still ones show instead, so no animation ever ends and nothing churns.
import { useCallback, useEffect, useRef, useState } from 'react';
import { randomTrace, STAGE_H, STAGE_W, STILL_TRACES, type Trace } from './auth-lines';

export const TRACE_SLOTS = 4;

interface Slot extends Trace {
  key: number;
  // The first round staggers its slots (data-wait in auth-motion.css); later routes start the moment one ends.
  wait: number | null;
}

export function AuthLines() {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const next = useRef(0);

  useEffect(() => {
    setSlots(
      Array.from({ length: TRACE_SLOTS }, (_, i) => ({
        ...randomTrace(Math.random),
        key: next.current++,
        wait: i,
      })),
    );
  }, []);

  const renew = useCallback((index: number) => {
    setSlots((prev) =>
      prev
        ? prev.map((s, i) =>
            i === index ? { ...randomTrace(Math.random), key: next.current++, wait: null } : s,
          )
        : prev,
    );
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        {STILL_TRACES.map((t) => (
          <path key={t.d} className={`lvd-auth-still ${t.tone}`} strokeWidth={2} d={t.d} />
        ))}
        {slots?.map((s, i) => (
          <path
            key={s.key}
            className={`lvd-auth-trace ${s.tone}`}
            data-wait={s.wait ?? undefined}
            onAnimationEnd={() => renew(i)}
            pathLength={100}
            strokeWidth={2}
            d={s.d}
          />
        ))}
      </svg>
    </div>
  );
}
