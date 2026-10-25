'use client';

import type { KeyboardEvent } from 'react';

// The house on/off switch, iOS style (docs/specs/004-interface-design/design-principles.md): a rounded track, brand
// when on and slate when off, with a white knob that slides across. One `role="switch"` button, named by `label`
// or by the element `labelledBy` points at, so a `<label htmlFor>` beside it flips it too. The button is a 44px
// square-ish hit area whatever the track's size (touch-targets.md), and its focus ring is drawn on the track.
//
// Space flips it, as the switch pattern asks; Enter is the button's own. `busy` holds it where it is while what it
// starts runs: still focusable and announced (`aria-busy`), but a press does nothing and the knob shows a spinner.
// `disabled` greys it out. The colours default to the host's `brand-*` ramp and slate; a panel painted in its own
// colours (a start panel in its tab's theme) passes `onColor` / `offColor`. `coversRow` stretches its hit area over
// the nearest positioned ancestor (a row marked `relative`), so a press anywhere on that row flips it, as a Settings
// row does; the row's other controls sit above that layer and keep their own presses.
export function Switch({
  checked,
  onChange,
  id,
  label,
  labelledBy,
  describedBy,
  disabled = false,
  busy = false,
  onColor,
  offColor,
  coversRow = false,
  className = '',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  id?: string;
  // Its accessible name when nothing visible names it.
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
  busy?: boolean;
  onColor?: string;
  offColor?: string;
  coversRow?: boolean;
  // The caller's spacing only.
  className?: string;
}) {
  const inert = disabled || busy;
  const flip = () => {
    if (!inert) onChange(!checked);
  };
  // Space flips on the press, as a switch does; the button's own click on release is held back so it never flips
  // twice.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== ' ') return;
    e.preventDefault();
    if (!e.repeat) flip();
  };
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ') e.preventDefault();
  };
  const trackColour = checked ? onColor : offColor;
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      disabled={disabled}
      data-switch=""
      onClick={flip}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      className={`group inline-flex h-11 w-14 ${coversRow ? "after:absolute after:inset-0 after:content-['']" : 'relative'} shrink-0 cursor-pointer items-center justify-center rounded-full outline-none disabled:cursor-not-allowed aria-busy:cursor-progress ${className}`}
    >
      <span
        aria-hidden
        data-switch-track=""
        className={`relative inline-flex h-[26px] w-11 items-center rounded-full shadow-[inset_0_0_0_1px_rgb(15_23_42/0.06)] transition-colors duration-short ease-out group-focus-visible:ring-2 group-focus-visible:ring-brand-500 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-white group-disabled:opacity-50 motion-reduce:transition-none dark:group-focus-visible:ring-brand-400 dark:group-focus-visible:ring-offset-slate-900 ${
          trackColour
            ? ''
            : checked
              ? 'bg-brand-500 dark:bg-brand-500'
              : 'bg-slate-300 dark:bg-slate-600'
        }`}
        style={trackColour ? { backgroundColor: trackColour } : undefined}
      >
        <span
          data-switch-knob=""
          className={`flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgb(15_23_42/0.25),0_1px_1px_rgb(15_23_42/0.08)] transition-transform duration-short ease-out motion-reduce:transition-none ${
            checked ? 'translate-x-[20px]' : 'translate-x-[2px]'
          }`}
        >
          {busy ? (
            // A small arc turning in the knob; still under reduced motion, where the knob alone says it is held.
            <span
              data-switch-spinner=""
              className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-slate-300 border-t-slate-600 motion-reduce:animate-none"
            />
          ) : null}
        </span>
      </span>
    </button>
  );
}
