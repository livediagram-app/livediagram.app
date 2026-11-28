'use client';

import { memo } from 'react';
import { HoverCard } from '@livehuddle/ui';
import { usePressWithoutDrag } from '@liveworkspace/workbench/hooks/ui/usePressWithoutDrag';
import { AVATAR_PAD_ART, AVATAR_PAD_VIEW, avatarPadPaint } from '@livehuddle/document';

// An Avatar Pad (docs/specs/009-elements/avatar-pad.md): the low round oak platform where Avatar-mode characters
// start. Drawn from the `AVATAR_PAD_ART` vector table, which the headless export draws too, in the Space's furniture
// style: the theme's stroke for its outline and its side's shade, its own fixed woods, rug and compass rose. Fitted
// whole into the box (`meet`), so the core stays on `avatarPadCore` at any size. One SVG of a fixed 12 parts, drawn
// once: nothing moves, no gradient, no filters, so a still board does no work for it (canvas-performance.md "A still
// Space does nothing").

const VIEW_BOX = `0 0 ${AVATAR_PAD_VIEW.width} ${AVATAR_PAD_VIEW.height}`;
// Until a stroke arrives (never on the canvas, which always passes one): the furniture's slate.
const FALLBACK_STROKE = '#64748b';

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
  return (
    <div className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}>
      {onPress ? (
        <HoverCard
          block
          className="absolute inset-0"
          title="Start Walking Here"
          description="Click to start walking from this pad."
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
        <svg
          viewBox={VIEW_BOX}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          {AVATAR_PAD_ART.map((p, index) => {
            const paint = avatarPadPaint(p.role, stroke);
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
      </div>
    </div>
  );
});
