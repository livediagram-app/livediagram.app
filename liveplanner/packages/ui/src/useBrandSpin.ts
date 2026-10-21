import { useEffect, useRef } from 'react';
import {
  easeOutCubic,
  PRISM_OPEN_MS,
  PRISM_SETTLE_MS,
  PRISM_SPIN_DEG_PER_S,
  PRISM_SPIN_RAMP_MS,
  prismFrame,
  restingTurn,
  settleTurn,
  type PrismFrame,
} from './brand-prism-motion';

// The DOM the spin writes to: the lid, the bottom fold, and each side face's
// left-lit and right-lit layers, in the order prismFrame returns the sides.
export type BrandSpinTargets = {
  top: SVGPathElement | null;
  bottom: SVGPathElement | null;
  left: (SVGPathElement | null)[];
  right: (SVGPathElement | null)[];
};

function paint(
  targets: BrandSpinTargets,
  frame: PrismFrame,
  opacity: { left: number; right: number },
) {
  targets.top?.setAttribute('d', frame.top);
  targets.bottom?.setAttribute('d', frame.bottom);
  frame.sides.forEach((side, i) => {
    for (const [layer, el] of [
      ['left', targets.left[i]],
      ['right', targets.right[i]],
    ] as const) {
      if (!el) continue;
      el.setAttribute('d', side.d);
      el.setAttribute('opacity', String(side[layer] * opacity[layer]));
    }
  });
}

// Opens and turns the prism while `active`, and settles it home after. Runs a
// frame loop only while moving, writes attributes directly (no React render per
// frame), and does nothing at all under prefers-reduced-motion.
// `layerOpacity` scales each layer (1 in colour, the mono face opacities in mono).
export function useBrandSpin(
  active: boolean,
  targets: React.RefObject<BrandSpinTargets>,
  layerOpacity: { left: number; right: number },
) {
  const state = useRef({ turn: 0, open: 0, velocity: 0, raf: 0 });
  const { left, right } = layerOpacity;

  useEffect(() => {
    const s = state.current;
    if (typeof window === 'undefined' || !window.matchMedia) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    cancelAnimationFrame(s.raf);

    const start = performance.now();
    const fromTurn = s.turn;
    const fromOpen = s.open;
    const fromVelocity = s.velocity;
    const home = restingTurn(fromTurn + fromVelocity * PRISM_SETTLE_MS * 0.5);
    let last = start;

    const tick = (now: number) => {
      const elapsed = now - start;
      if (active) {
        // A settle leaves the velocity at 0, so a spin always eases up from rest.
        s.velocity = (PRISM_SPIN_DEG_PER_S / 1000) * easeOutCubic(elapsed / PRISM_SPIN_RAMP_MS);
        s.turn += s.velocity * (now - last);
        s.open = fromOpen + (1 - fromOpen) * easeOutCubic(elapsed / PRISM_OPEN_MS);
      } else {
        const t = elapsed / PRISM_SETTLE_MS;
        s.turn = settleTurn(fromTurn, fromVelocity, home, t);
        s.open = fromOpen * (1 - easeOutCubic(t));
        s.velocity = 0;
      }
      last = now;
      if (targets.current) paint(targets.current, prismFrame(s), { left, right });
      if (!active && elapsed >= PRISM_SETTLE_MS) {
        // Home: the box is the same every quarter turn, so reset to 0 and
        // repaint the exact resting artwork.
        s.turn = 0;
        s.open = 0;
        if (targets.current) paint(targets.current, prismFrame(s), { left, right });
        return;
      }
      s.raf = requestAnimationFrame(tick);
    };
    if (active || s.open > 0 || s.turn !== 0) s.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(s.raf);
  }, [active, targets, left, right]);
}
