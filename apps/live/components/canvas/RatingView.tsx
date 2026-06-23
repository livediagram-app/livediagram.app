'use client';

// Rating element (spec/52): a row of five stars showing a 1–5 score. Rendered
// by BoxedElementView for shape === 'rating'. Filled stars take the element's
// accent (stroke) colour; empty stars are a muted outline. `ratingAnim` drives
// a looping / one-shot `lvd-rating-*` animation on the filled stars (pop /
// twinkle / pulse / rock), deterministic + reduced-motion-safe like the other
// element animations so it freezes cleanly on export.

import {
  ANIMATION_SPEED_FACTOR,
  animLoops,
  clampRating,
  RATING_DEFAULT,
  RATING_LOOPING_ANIMS,
  RATING_MAX,
  type ShapeElement,
} from '@livediagram/diagram';
import { animClass, animSpeedVars } from '@/lib/icons';

const STAR_PATH =
  'M12 2.6l2.7 5.47 6.04.88-4.37 4.26 1.03 6.02L12 16.85 6.6 19.23l1.03-6.02L3.26 8.95l6.04-.88z';

export function RatingView({ element, accent }: { element: ShapeElement; accent: string }) {
  const score = clampRating(element.rating ?? RATING_DEFAULT);
  const anim = element.ratingAnim;
  const loops = animLoops(anim, element.ratingAnimRepeat, RATING_LOOPING_ANIMS);
  const speed = ANIMATION_SPEED_FACTOR[element.ratingAnimSpeed ?? 'normal'];
  // Size each star to the box: fit five across the width, capped by height.
  const star = Math.max(12, Math.min(element.height * 0.8, (element.width / RATING_MAX) * 0.86));
  const cls = animClass('rating', anim);
  // pop / twinkle stagger across the row; pulse / rock move in unison.
  const stagger = anim === 'pop' || anim === 'twinkle';
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ gap: star * 0.16 }}>
      {Array.from({ length: RATING_MAX }, (_, i) => {
        const filled = i < score;
        return (
          <svg
            key={i}
            width={star}
            height={star}
            viewBox="0 0 24 24"
            className={filled ? cls : undefined}
            style={
              filled && cls
                ? {
                    ...animSpeedVars('rating', element.ratingAnimSpeed, loops),
                    animationDelay: stagger ? `${i * 0.12 * speed}s` : '0s',
                    transformOrigin: 'center',
                  }
                : undefined
            }
            aria-hidden
          >
            <path
              d={STAR_PATH}
              fill={filled ? accent : 'none'}
              stroke={filled ? accent : '#cbd5e1'}
              strokeWidth={filled ? 0 : 1.6}
              strokeLinejoin="round"
            />
          </svg>
        );
      })}
    </div>
  );
}
