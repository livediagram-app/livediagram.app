// The Done check's hero (docs/specs/012-collaboration/done-check.md "Reading the card"): a progress ring in the
// accent that fills as people finish, the count large in the middle. Complete,
// it turns green and the count becomes a check. When the last person finishes
// while the card is on screen, a burst of confetti goes off from it, once: it
// celebrates the moment, not a card that loaded already complete.

import { useState } from 'react';
import { tint } from '../collab-chrome';
import { CheckGlyph, QA_ACCENT } from '../qa/qa-parts';
import { CelebrationBurst } from '../CelebrationBurst';

const SIZE = 84;
const STROKE = 7;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
const GREEN = '#22c55e';
export function DoneRing({
  done,
  total,
  textColor,
}: {
  done: number;
  total: number;
  textColor: string;
}) {
  const complete = total > 0 && done >= total;
  const [initiallyComplete] = useState(complete);
  const share = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          style={{ stroke: tint(textColor, 0.08) }}
        />
        <circle
          className="done-ring-arc"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - share)}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          style={{ stroke: complete ? GREEN : QA_ACCENT }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        {complete ? (
          <span key="done" className="qa-pop inline-flex" style={{ color: GREEN }}>
            <CheckGlyph size={30} />
          </span>
        ) : (
          <span
            className="text-[18px] font-bold leading-none tabular-nums"
            style={{ color: textColor }}
          >
            {done}
            <span className="text-[12px] font-semibold opacity-50">/{total}</span>
          </span>
        )}
      </span>
      {complete && !initiallyComplete ? <CelebrationBurst /> : null}
    </span>
  );
}
