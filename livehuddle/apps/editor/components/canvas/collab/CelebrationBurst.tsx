// A one-off burst of confetti from the centre of whatever holds it: the Done
// check's ring completing (docs/specs/012-collaboration/done-check.md) and an Action panel's action
// being marked complete (docs/specs/012-collaboration/action-panel.md). The host decides WHEN (only for a
// change seen on screen, never for a card that loaded already complete); this
// is only the look, so both celebrations are the same celebration. The
// `.done-burst` keyframes live in app/qa-board.css and collapse under reduced
// motion with everything else there.

import type { CSSProperties } from 'react';

// Angle (deg) and colour per particle, fixed so it renders the same for
// everyone and in tests.
const PARTICLES = [
  [0, '#fbbf24'],
  [36, '#22d3ee'],
  [72, '#fb7185'],
  [108, '#a3e635'],
  [144, '#60a5fa'],
  [180, '#fbbf24'],
  [216, '#22c55e'],
  [252, '#fb7185'],
  [288, '#22d3ee'],
  [324, '#a3e635'],
] as const;

export function CelebrationBurst() {
  return (
    <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
      {PARTICLES.map(([deg, color], i) => (
        <span
          key={i}
          className="done-burst absolute h-1.5 w-1.5 rounded-full"
          style={
            {
              backgroundColor: color,
              '--burst-angle': `${deg}deg`,
              animationDelay: `${(i % 3) * 30}ms`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
