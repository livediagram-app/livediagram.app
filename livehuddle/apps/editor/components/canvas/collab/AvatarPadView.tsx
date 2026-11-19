'use client';

import { memo, useId } from 'react';
import { HoverCard } from '@livehuddle/ui';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import {
  AVATAR_PAD_ART,
  AVATAR_PAD_GLOW,
  AVATAR_PAD_VIEW,
  avatarPadPaint,
  chairSeatFill,
  isAvatarPadLight,
} from '@livehuddle/document';

// An Avatar Pad (docs/specs/009-elements/avatar-pad.md): the teleport platform where Avatar-mode characters start.
// Drawn from the `AVATAR_PAD_ART` vector table, which the headless export draws too, in the Space's furniture style:
// the theme's stroke and seat wash for the platform, a fixed brand-cyan light for the ring, core and lamps. Fitted
// whole into the box (`meet`), so the core stays on `avatarPadCore` at any size. The lights shimmer on a gentle
// opacity loop (`avatar-pad-shimmer` in canvas-motion.css), off under reduced motion. The table is drawn in layers, back
// to front, one SVG for each run of parts that are lights or not: each run of lights sits in a box of its own that
// carries the shimmer, so the browser's compositor fades it and a still board does no work for it (canvas-performance.md
// "A still Space does nothing"). A fixed 17 parts in five layers plus one static gradient per pad; no filters.

const VIEW_BOX = `0 0 ${AVATAR_PAD_VIEW.width} ${AVATAR_PAD_VIEW.height}`;
// Until a stroke arrives (never on the canvas, which always passes one): the furniture's slate.
const FALLBACK_STROKE = '#64748b';

type Run = { light: boolean; parts: { part: (typeof AVATAR_PAD_ART)[number]; index: number }[] };
// The table's runs of lights and of everything else, in order: worked out once, the table is fixed.
const RUNS: readonly Run[] = AVATAR_PAD_ART.reduce<Run[]>((runs, part, index) => {
  const light = isAvatarPadLight(part.role);
  const last = runs[runs.length - 1];
  if (last && last.light === light) last.parts.push({ part, index });
  else runs.push({ light, parts: [{ part, index }] });
  return runs;
}, []);

// `onPress` makes the pad a control too (docs/specs/009-elements/avatar-pad.md "Pressing it"): a click starts Avatar
// mode on it, a drag still moves it (usePressWithoutDrag), as the Portal's face does.
export const AvatarPadView = memo(function AvatarPadView({
  stroke = FALLBACK_STROKE,
  animClass,
  onPress,
}: {
  stroke?: string;
  animClass?: string;
  onPress?: () => void;
}) {
  const press = usePressWithoutDrag(onPress);
  const glowId = `avatar-pad-glow-${useId().replace(/:/g, '')}`;
  const body = chairSeatFill(undefined, stroke);
  return (
    <div className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}>
      {onPress ? (
        <HoverCard
          block
          className="absolute inset-0"
          title="Start Walking Here"
          description="Click to start Avatar mode on this pad."
        >
          <button
            type="button"
            aria-label="Start walking on this pad"
            {...press}
            className="pointer-events-auto absolute inset-0 cursor-pointer"
          />
        </HoverCard>
      ) : null}
      <div className="absolute inset-0" role="img" aria-label="Avatar Pad" data-avatar-pad="">
        {RUNS.map((run, r) => {
          const layer = (
            <svg
              key={r}
              viewBox={VIEW_BOX}
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 h-full w-full overflow-visible"
              aria-hidden
            >
              {r === 0 ? (
                <defs>
                  <radialGradient id={glowId}>
                    <stop
                      offset="0%"
                      stopColor={AVATAR_PAD_GLOW.color}
                      stopOpacity={AVATAR_PAD_GLOW.innerOpacity}
                    />
                    <stop offset="100%" stopColor={AVATAR_PAD_GLOW.color} stopOpacity={0} />
                  </radialGradient>
                </defs>
              ) : null}
              {run.parts.map(({ part: p, index }) => {
                const paint = avatarPadPaint(p.role, stroke, body, `url(#${glowId})`);
                return p.tag === 'ellipse' ? (
                  <ellipse
                    key={index}
                    cx={p.cx}
                    cy={p.cy}
                    rx={p.rx}
                    ry={p.ry}
                    {...paint}
                    data-pad-role={p.role}
                  />
                ) : (
                  <path key={index} d={p.d} {...paint} data-pad-role={p.role} />
                );
              })}
            </svg>
          );
          return run.light ? (
            <div key={r} className="avatar-pad-shimmer absolute inset-0" data-pad-lights="">
              {layer}
            </div>
          ) : (
            layer
          );
        })}
      </div>
    </div>
  );
});
