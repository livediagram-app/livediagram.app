// The room's average as a mood meter (docs/specs/012-collaboration/temperature-check.md "The face"): a
// cool-to-warm track with a glowing marker that glides to the average, and
// the number large with the respondent count. Empty, the track is
// quiet with no marker, rather than an average of zero, which would read as a
// very unhappy room.

import { TEMPERATURE_COLORS, temperaturePosition } from '@livediagram/document';
import { tint } from '../collab-chrome';
import { MOOD_GRID } from './mood-grid';

const TRACK = `linear-gradient(90deg, ${TEMPERATURE_COLORS.join(', ')})`;

export function MoodMeter({
  average,
  count,
  textColor,
}: {
  average: number | null;
  count: number;
  textColor: string;
}) {
  const empty = average === null || count === 0;
  const pos = empty ? 0 : temperaturePosition(average);
  const hue = empty ? textColor : TEMPERATURE_COLORS[Math.round(pos * 4)]!;
  return (
    <div className="flex shrink-0 flex-col gap-2">
      {/* On the faces' grid, spanning from the centre of the first column to
          the centre of the last, so a reading of 4 sits directly under the 4
          and a 1 or 5 rests on the track's end, inside the card. */}
      <div className={MOOD_GRID}>
        <div className="col-span-5 px-[calc((100%-24px)/10)]">
          <div
            className="relative h-2.5 rounded-full"
            style={{ background: TRACK, opacity: empty ? 0.25 : 0.9 }}
          >
            {empty ? null : (
              <span
                aria-hidden
                className="mood-marker absolute top-1/2 h-4 w-4 rounded-full border-[3px] bg-white"
                style={{
                  left: `${pos * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  borderColor: hue,
                  boxShadow: `0 0 0 4px ${tint(hue, 0.25)}, 0 4px 10px -2px ${tint(hue, 0.7)}`,
                }}
              />
            )}
          </div>
        </div>
      </div>
      {empty ? (
        <p className="flex items-baseline gap-2 leading-none" style={{ color: textColor }}>
          <span className="text-[12.5px] font-semibold">No readings yet</span>
          <span className="text-[11px] opacity-55">Tap the face that fits.</span>
        </p>
      ) : (
        <p className="flex items-baseline gap-2 leading-none" style={{ color: textColor }}>
          <span className="text-[22px] font-bold tabular-nums">{average.toFixed(1)}</span>
          <span className="ml-auto text-[10.5px] opacity-55">
            from {count} {count === 1 ? 'person' : 'people'}
          </span>
        </p>
      )}
    </div>
  );
}
