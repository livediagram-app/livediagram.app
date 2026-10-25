'use client';

import type { ButtonHTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from 'react';

// The house on/off switch, iOS style (docs/specs/004-interface-design/design-principles.md, "One switch"): a rounded
// track, brand when on and slate when off, with a white knob that slides across. Every on/off switch in every app is
// drawn here, and this file is the only one that writes `role="switch"` (switch-guard.test.ts):
//
// - `Switch`, one `role="switch"` button, named by `label` or by the element `labelledBy` points at, so a
//   `<label htmlFor>` beside it flips it too.
// - `SwitchRow`, a row (or pill) that is itself the switch, its words and the track inside one button, so it is one
//   hit target and one announcement.
// - `SwitchChip`, a chip that flips, for a row of short names where a track each would crowd (Settings' toggle
//   groups, a photo tool's option chips).
//
// A `presentational` Switch is the picture alone (aria-hidden), for a row that owns the press and its own semantics.
//
// Sizes: `md` (a 26 x 44 track in a 44 x 56 box, the default), `sm` (20 x 36, dense rows: Settings, popovers, palette
// controls, dialogs) and `xs` (16 x 28, inside a note or a dark presentation panel). Every size keeps a 44px touch
// target (touch-targets.md): `md` by its own box, `sm` and `xs` by the `touch-target` pad. The focus ring is drawn on
// the track.
//
// Space flips it, as the switch pattern asks; Enter is the button's own. `busy` holds it where it is while what it
// starts runs: still focusable and announced (`aria-busy`), but a press does nothing and the knob shows a spinner.
// `disabled` greys it out. The colours default to the host's `brand-*` ramp and slate; a panel painted in its own
// colours (a start panel in its tab's theme) passes `onColor` / `offColor`. `coversRow` stretches its hit area over
// the nearest positioned ancestor (a row marked `relative`), so a press anywhere on that row flips it, as a Settings
// row does; the row's other controls sit above that layer and keep their own presses.

export type SwitchSize = 'xs' | 'sm' | 'md';

const SIZES: Record<
  SwitchSize,
  {
    box: string;
    pad: string;
    track: string;
    knob: string;
    on: string;
    off: string;
    spinner: string;
  }
> = {
  md: {
    box: 'h-11 w-14',
    pad: '',
    track: 'h-[26px] w-11 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.06)]',
    knob: 'h-[22px] w-[22px] shadow-[0_1px_3px_rgb(15_23_42/0.25),0_1px_1px_rgb(15_23_42/0.08)]',
    on: 'translate-x-[20px]',
    off: 'translate-x-[2px]',
    spinner: 'h-3 w-3',
  },
  // The compact switch the editors and Settings have always drawn (ToggleSwitch), to the pixel.
  sm: {
    box: '',
    pad: 'touch-target',
    track: 'h-5 w-9',
    knob: 'h-3.5 w-3.5 shadow-sm',
    on: 'translate-x-[18px]',
    off: 'translate-x-[3px]',
    spinner: 'h-2.5 w-2.5',
  },
  xs: {
    box: '',
    pad: 'touch-target',
    track: 'h-4 w-7',
    knob: 'h-3 w-3 shadow-sm',
    on: 'translate-x-[14px]',
    off: 'translate-x-[2px]',
    spinner: 'h-2 w-2',
  },
};

type TrackProps = {
  checked: boolean;
  size?: SwitchSize;
  busy?: boolean;
  onColor?: string;
  offColor?: string;
  // Drawn in the knob (a glyph that says what on means); `busy`'s spinner takes its place.
  knob?: ReactNode;
};

// The track and its knob. `focusable` draws the focus and disabled looks off the enclosing `group` button.
function SwitchTrack({
  checked,
  size = 'md',
  busy = false,
  onColor,
  offColor,
  knob,
  focusable,
}: TrackProps & { focusable: boolean }) {
  const s = SIZES[size];
  const trackColour = checked ? onColor : offColor;
  return (
    <span
      aria-hidden
      data-switch-track=""
      className={`relative inline-flex shrink-0 items-center rounded-full transition-colors duration-short ease-out motion-reduce:transition-none ${s.track} ${
        focusable
          ? 'group-focus-visible:ring-2 group-focus-visible:ring-brand-500 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-white group-disabled:opacity-50 dark:group-focus-visible:ring-brand-400 dark:group-focus-visible:ring-offset-slate-900'
          : ''
      } ${
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
        className={`flex items-center justify-center rounded-full bg-white transition-transform duration-short ease-out motion-reduce:transition-none ${s.knob} ${
          checked ? s.on : s.off
        }`}
      >
        {busy ? (
          // A small arc turning in the knob; still under reduced motion, where the knob alone says it is held.
          <span
            data-switch-spinner=""
            className={`animate-spin rounded-full border-[1.5px] border-slate-300 border-t-slate-600 motion-reduce:animate-none ${s.spinner}`}
          />
        ) : (
          knob
        )}
      </span>
    </span>
  );
}

// Space flips on the press, as a switch does; the button's own click on release is held back so it never flips
// twice.
function spaceFlips(flip: () => void) {
  return {
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key !== ' ') return;
      e.preventDefault();
      if (!e.repeat) flip();
    },
    onKeyUp: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ') e.preventDefault();
    },
  };
}

export function Switch(
  props: TrackProps & {
    // The picture alone, for a row that is the control (see SwitchRow, or a row that keeps its own semantics).
    presentational: true;
    className?: string;
  },
): ReactNode;
export function Switch(
  props: TrackProps & {
    presentational?: false;
    onChange: (next: boolean) => void;
    id?: string;
    // Its accessible name when nothing visible names it.
    label?: string;
    labelledBy?: string;
    describedBy?: string;
    disabled?: boolean;
    coversRow?: boolean;
    // The caller's spacing only.
    className?: string;
  },
): ReactNode;
export function Switch({
  checked,
  size = 'md',
  busy = false,
  onColor,
  offColor,
  knob,
  presentational = false,
  onChange,
  id,
  label,
  labelledBy,
  describedBy,
  disabled = false,
  coversRow = false,
  className = '',
}: TrackProps & {
  presentational?: boolean;
  onChange?: (next: boolean) => void;
  id?: string;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
  coversRow?: boolean;
  className?: string;
}) {
  const track = { checked, size, busy, onColor, offColor, knob };
  if (presentational) {
    return (
      <span
        aria-hidden
        data-switch=""
        data-switch-size={size}
        className={`inline-flex shrink-0 ${className}`}
      >
        <SwitchTrack {...track} focusable={false} />
      </span>
    );
  }
  const inert = disabled || busy;
  const flip = () => {
    if (!inert) onChange?.(!checked);
  };
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
      data-switch-size={size}
      onClick={flip}
      {...spaceFlips(flip)}
      className={`group inline-flex ${SIZES[size].box} ${coversRow ? "after:absolute after:inset-0 after:content-['']" : `relative ${SIZES[size].pad}`} shrink-0 cursor-pointer items-center justify-center rounded-full outline-none disabled:cursor-not-allowed aria-busy:cursor-progress ${className}`}
    >
      <SwitchTrack {...track} focusable />
    </button>
  );
}

type RowButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'role' | 'type' | 'aria-checked' | 'className' | 'children'
>;

// The row's layout when the caller names none: the words, then the switch at the end.
const ROW_LAYOUT = 'flex w-full items-center justify-between gap-3 rounded-md text-left';

/**
 * A row that is itself the switch: its words and the track (a presentational Switch) inside one `role="switch"`
 * button, named by its words (or `aria-label`), so it is one hit target and one announcement. `layout` replaces the
 * default row layout (a pill, a toolbar chip); `className` adds to it. `track` puts the switch before or after the
 * words (held in a `min-w-0` span, so they can shrink), or leaves it out (see SwitchChip). An `onClick` the caller
 * passes runs first (to stop a press reaching the canvas); the row then flips, unless that handler called
 * `preventDefault`. Enter and Space are the button's own.
 */
export function SwitchRow({
  checked,
  onChange,
  children,
  layout = ROW_LAYOUT,
  className = '',
  disabled = false,
  size = 'sm',
  track = 'end',
  onColor,
  offColor,
  knob,
  onClick,
  ...rest
}: RowButtonProps & {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
  layout?: string;
  // The caller's spacing, border, colours and type size.
  className?: string;
  disabled?: boolean;
  size?: SwitchSize;
  track?: 'start' | 'end' | 'none';
  onColor?: string;
  offColor?: string;
  knob?: ReactNode;
}) {
  const picture =
    track === 'none' ? null : (
      <Switch
        presentational
        checked={checked}
        size={size}
        onColor={onColor}
        offColor={offColor}
        knob={knob}
      />
    );
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-switch-row=""
      {...rest}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        if (!e.defaultPrevented) onChange(!checked);
      }}
      className={`${layout} cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {track === 'start' ? picture : null}
      {track === 'none' ? children : <span className="min-w-0">{children}</span>}
      {track === 'end' ? picture : null}
    </button>
  );
}

/**
 * A chip that flips: a `role="switch"` button with no track, whose look (tinted while on) is the caller's, through
 * `className`. For a row of short names where a track each would crowd.
 */
export function SwitchChip({
  layout = '',
  ...props
}: Omit<Parameters<typeof SwitchRow>[0], 'track' | 'size' | 'onColor' | 'offColor' | 'knob'>) {
  return <SwitchRow {...props} layout={layout} track="none" />;
}
