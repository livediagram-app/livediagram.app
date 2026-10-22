// The shape of the room (docs/specs/012-collaboration/temperature-check.md "The face"): a rounded bar per value,
// easing to its share of the busiest value, with its count over it. A flat 3
// across the board and a split between 1s and 5s average the same and mean
// opposite things, so these, not the average, are the main read. A count that
// rises after the card first painted pops.

import { useState } from 'react';
import { TEMPERATURE_COLORS, TEMPERATURE_VALUES } from '@livedesign/document';
import { tint } from '../collab-chrome';
import { MOOD_GRID } from './mood-grid';
import { useFaceShadow } from '@/components/canvas/CanvasFinishContext';

export function MoodBars({ tally, textColor }: { tally: number[]; textColor: string }) {
  const [initial] = useState(tally);
  const peak = Math.max(1, ...tally);
  const shadow = useFaceShadow();
  return (
    // Takes whatever height the card has spare, so a tall card gets taller
    // bars rather than dead space.
    <div className={`${MOOD_GRID} min-h-[64px] flex-1`} aria-hidden>
      {tally.map((count, i) => {
        const hue = TEMPERATURE_COLORS[i]!;
        const rose = count > (initial[i] ?? 0);
        return (
          <div key={TEMPERATURE_VALUES[i]} className="flex min-h-0 flex-col items-center gap-1">
            <span
              key={count}
              className={`text-[10px] font-semibold leading-none tabular-nums ${rose ? 'qa-pop' : ''}`}
              style={{ color: textColor, opacity: count ? 0.8 : 0.3 }}
            >
              {count}
            </span>
            <span
              // Track and bar are a shape each under Marker and Sketch (docs/specs/008-canvas/finish.md "Faces"); the
              // bar's gradient is drawn in its hue.
              data-marker-shape=""
              className="relative flex min-h-0 w-full max-w-[28px] flex-1 items-end overflow-hidden rounded-full"
              style={{ backgroundColor: tint(textColor, 0.06) }}
            >
              <span
                data-marker-shape=""
                data-marker-fill={hue}
                className="mood-bar relative w-full rounded-full"
                style={{
                  // A share of the track, with a floor so one vote in a tall
                  // card is still a visible bar rather than a hairline.
                  height: count === 0 ? 0 : `max(10px, ${(count / peak) * 100}%)`,
                  background: `linear-gradient(180deg, ${hue}, ${tint(hue, 0.75)})`,
                  boxShadow: shadow(count ? `0 0 12px -2px ${tint(hue, 0.6)}` : undefined),
                }}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}
