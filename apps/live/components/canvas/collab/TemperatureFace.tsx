// The face of a Temperature check (spec/124): fist-of-five. Five pressable
// readings over five bars, with the average under them.
//
// Deliberately never hidden, the opposite choice from the estimate card:
// watching the bars move as people answer IS the reading, and it shows a
// dissenter they are not alone before they have to say so out loud.

import {
  TEMPERATURE_VALUES,
  responseOf,
  responseStats,
  responseTally,
  type ShapeElement,
} from '@livediagram/diagram';
import { CollabChip, CollabEmpty, CollabPanel } from './collab-chrome';

// Cool to warm across the five bars. Fixed hues rather than the theme's
// palette: a temperature check that recoloured with the tab theme would read
// as five arbitrary bars, and "the low one is the cold one" is the whole
// glanceable part.
const BAR_COLORS = ['#60a5fa', '#22d3ee', '#a3e635', '#fbbf24', '#fb7185'];

export function TemperatureFace({
  element,
  label,
  textColor,
  selfId,
  onRespond,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  selfId: string;
  onRespond?: (value: string) => void;
}) {
  const responses = element.responses ?? [];
  const mine = responseOf(responses, selfId);
  const stats = responseStats(responses);
  const tally = responseTally(responses, TEMPERATURE_VALUES);
  const peak = Math.max(1, ...tally);

  return (
    <CollabPanel
      title={label.trim() || 'How are we feeling?'}
      textColor={textColor}
      aside={stats.count ? `${stats.count} answered` : undefined}
    >
      <div className="flex gap-1.5">
        {TEMPERATURE_VALUES.map((value) => (
          <CollabChip
            key={value}
            value={value}
            mine={mine === value}
            onPress={onRespond ? () => onRespond(value) : undefined}
            textColor={textColor}
          />
        ))}
      </div>
      {stats.count === 0 ? (
        <CollabEmpty textColor={textColor}>
          No readings yet. Pick 1 (blocked) through 5 (enthusiastic).
        </CollabEmpty>
      ) : (
        <>
          {/* The SHAPE of the room, not just its average: a flat 3 across the
              board and a split between 1s and 5s average the same and mean
              opposite things (spec/124). */}
          <div className="flex gap-1.5" aria-hidden>
            {tally.map((count, i) => (
              <div key={TEMPERATURE_VALUES[i]} className="flex flex-1 flex-col items-center gap-1">
                {/* Each column is a TRACK with the count filling it from the
                    bottom. Bare bars sitting on nothing made an unchosen value
                    a stray coloured dash floating at the baseline, which read
                    as a broken axis rather than as "nobody picked this". */}
                <span
                  // Capped in width so a wide card doesn't turn five readings
                  // into five slabs.
                  className="flex h-[48px] w-full max-w-[26px] items-end overflow-hidden rounded bg-black/[0.06] dark:bg-white/10"
                >
                  <span
                    className="w-full rounded-t transition-all"
                    style={{
                      height: count === 0 ? 0 : `${Math.max(8, (count / peak) * 48)}px`,
                      backgroundColor: BAR_COLORS[i],
                    }}
                  />
                </span>
                <span className="text-[9px] tabular-nums opacity-60" style={{ color: textColor }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
          <p className="leading-none" style={{ color: textColor }}>
            <span className="text-[20px] font-semibold tabular-nums">
              {stats.average === null ? '—' : stats.average.toFixed(1)}
            </span>
            <span className="ml-2 text-[11px] opacity-55">
              average from {stats.count} {stats.count === 1 ? 'person' : 'people'}
            </span>
          </p>
        </>
      )}
    </CollabPanel>
  );
}
