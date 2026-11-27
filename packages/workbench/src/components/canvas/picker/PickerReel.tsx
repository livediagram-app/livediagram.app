'use client';

// The Picker's reel window (docs/specs/012-collaboration/picker.md "The look"): a strip of names behind an
// opening, the middle row inside the payline. At rest the strip is three rows standing still; during a
// spin it is the whole run of frames, scrolled on ONE transform (picker-face.css), fast then slowing,
// so it reads as a reel turning rather than text being swapped. The rows above and below fade into the
// card through a mask, so the depth survives any theme.

import type { CSSProperties, ReactNode } from 'react';
import type { PickerCandidate, PickerPerson } from '../../../lib/picker';
import type { PickerLayout } from '@liveworkspace/element-model/picker-layout';

export function PickerReel<P extends PickerPerson>({
  strip,
  spinning,
  durationMs,
  landKey,
  layout,
  placeholder,
  renderAvatar,
}: {
  // At rest: [above, payline, below]. Spinning: the run from where it stood to where it lands.
  strip: readonly (PickerCandidate<P> | null)[];
  spinning: boolean;
  durationMs: number;
  // Changes on every landing, so the payline's pop replays (and does not play on a reload).
  landKey: number;
  layout: PickerLayout;
  // What the payline says with nothing on it ("?", "All drawn"...).
  placeholder: ReactNode;
  renderAvatar?: (participant: P, size: number) => ReactNode;
}) {
  const { rowH, nameSize, neighbours, avatarSize } = layout;
  // The payline plus half a row either side of it, or the payline alone on a short card.
  const visible = neighbours ? 2 : 1;
  // Index of the row on the payline at the start and the end of the strip.
  const first = 1;
  const last = strip.length - 2;
  // Where the payline row sits in the window, in rows from its top.
  const shift = neighbours ? 0.5 : 0;
  const offset = (i: number) => `${(shift - i) * rowH}px`;
  const multiline = rowH > nameSize * 2;
  return (
    <div
      className={`picker-window relative w-full shrink-0 overflow-hidden ${neighbours ? '' : 'picker-window-single'}`}
      style={{ height: visible * rowH }}
      aria-hidden
    >
      {/* The payline: the theme accent as a tinted band with a notch at each end. */}
      <span
        key={`band-${landKey}`}
        className={`picker-payline pointer-events-none absolute inset-x-1 rounded-[10px] ${
          landKey > 0 ? 'picker-payline-landed' : ''
        }`}
        style={{ top: shift * rowH, height: rowH }}
      >
        <span className="picker-notch picker-notch-left" />
        <span className="picker-notch picker-notch-right" />
      </span>
      <div
        key={spinning ? `spin-${landKey}` : 'rest'}
        className={`picker-strip absolute inset-x-0 top-0 ${spinning ? 'picker-strip-spinning' : ''}`}
        style={
          {
            '--picker-from': offset(first),
            '--picker-to': offset(last),
            '--picker-spin-ms': `${durationMs}ms`,
            transform: `translateY(${offset(spinning ? last : first)})`,
          } as CSSProperties
        }
      >
        {strip.map((candidate, i) => {
          const onLine = !spinning && i === first;
          return (
            <div
              key={i}
              className={`flex items-center justify-center gap-2 px-6 ${onLine && landKey > 0 ? 'picker-land' : ''}`}
              style={{ height: rowH }}
            >
              {candidate === null ? (
                onLine ? (
                  placeholder
                ) : null
              ) : (
                <>
                  {candidate.participant && renderAvatar
                    ? renderAvatar(candidate.participant, avatarSize)
                    : null}
                  <span
                    className={`min-w-0 text-center font-semibold leading-tight ${
                      multiline && onLine ? 'line-clamp-2' : 'truncate'
                    }`}
                    style={{ fontSize: nameSize, color: 'var(--picker-ink)' }}
                  >
                    {candidate.label}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
