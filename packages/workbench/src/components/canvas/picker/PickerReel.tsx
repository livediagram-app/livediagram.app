'use client';

// The Picker's reel window (docs/specs/012-collaboration/picker.md "The look"): a strip of names behind an
// opening, the middle row inside the payline. During a spin the strip is the whole run of frames,
// scrolled on ONE transform (picker-face.css), fast then slowing, so it reads as a reel turning rather
// than text being swapped; the rows passing above and below fade out through a mask. At rest the
// names either side are set small and whole inside the peek, muted: the next names on the reel, never
// a name sliced by the window's edge or by whatever sits next to the window.

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
  const { rowH, nameSize, peek, lines, avatarSize, compact } = layout;
  // Where row `i` of the spinning strip stands: the run starts with row 1 on the payline and ends
  // with the landing (the last row but one) there.
  const offset = (i: number) => `${peek - i * rowH}px`;
  // A name that may wrap is clamped to the payline's lines; one that may not stays on one line.
  const nameFit: CSSProperties =
    lines > 1
      ? {
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: lines,
          overflow: 'hidden',
          textWrap: 'balance',
        }
      : {};
  const inset = compact ? 'px-4' : 'px-6';
  const name = (candidate: PickerCandidate<P>) => (
    <>
      {candidate.participant && renderAvatar
        ? renderAvatar(candidate.participant, avatarSize)
        : null}
      <span
        className={`min-w-0 text-center font-semibold leading-tight ${lines > 1 ? '' : 'truncate'}`}
        style={{ ...nameFit, fontSize: nameSize, color: 'var(--picker-ink)' }}
      >
        {candidate.label}
      </span>
    </>
  );
  // The names either side at rest, small enough to sit whole in the peek; none when it can't hold
  // a readable one.
  const nearSize = Math.min(20, nameSize * 0.6, (peek - 2) / 1.25);
  const near = (candidate: PickerCandidate<P> | null | undefined) => (
    <div
      className={`flex items-center justify-center gap-1.5 overflow-hidden ${inset}`}
      style={{ height: peek, opacity: 0.55 }}
    >
      {candidate && nearSize >= 9 ? (
        <>
          {/* An avatar only where it fits with its ring; a thin peek keeps just the name. */}
          {candidate.participant && renderAvatar && nearSize * 1.3 + 6 <= peek
            ? renderAvatar(candidate.participant, Math.round(nearSize * 1.3))
            : null}
          <span
            className="min-w-0 truncate font-semibold leading-tight"
            style={{ fontSize: nearSize, color: 'var(--picker-ink)' }}
          >
            {candidate.label}
          </span>
        </>
      ) : null}
    </div>
  );
  return (
    <div
      className={`picker-window relative w-full shrink-0 overflow-hidden ${spinning && peek > 0 ? '' : 'picker-window-single'}`}
      style={{ height: rowH + 2 * peek, '--picker-peek': `${peek}px` } as CSSProperties}
      aria-hidden
    >
      {/* The payline: the theme accent as a tinted band with a notch at each end. */}
      <span
        key={`band-${landKey}`}
        className={`picker-payline pointer-events-none absolute inset-x-1 rounded-[10px] ${
          landKey > 0 ? 'picker-payline-landed' : ''
        }`}
        style={{ top: peek, height: rowH }}
      >
        <span className="picker-notch picker-notch-left" />
        <span className="picker-notch picker-notch-right" />
      </span>
      {spinning ? (
        <div
          key={`spin-${landKey}`}
          className="picker-strip picker-strip-spinning absolute inset-x-0 top-0"
          style={
            {
              '--picker-from': offset(1),
              '--picker-to': offset(strip.length - 2),
              '--picker-spin-ms': `${durationMs}ms`,
              transform: `translateY(${offset(strip.length - 2)})`,
            } as CSSProperties
          }
        >
          {strip.map((candidate, i) => (
            <div
              key={i}
              className={`flex items-center justify-center gap-2 ${inset}`}
              style={{ height: rowH }}
            >
              {candidate === null ? null : name(candidate)}
            </div>
          ))}
        </div>
      ) : (
        <div className="picker-strip absolute inset-x-0 top-0">
          {peek > 0 ? near(strip[0]) : null}
          <div
            className={`flex items-center justify-center gap-2 ${inset} ${landKey > 0 ? 'picker-land' : ''}`}
            style={{ height: rowH }}
          >
            {strip[1] ? name(strip[1]) : placeholder}
          </div>
          {peek > 0 ? near(strip[2]) : null}
        </div>
      )}
    </div>
  );
}
