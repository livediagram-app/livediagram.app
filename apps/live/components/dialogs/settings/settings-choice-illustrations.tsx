import type { ReactNode } from 'react';
import { GAP, H, REM_PER_UNIT, StateFrame, W, pickable } from './settings-illustration-kit';

// One small drawing per OPTION of a pick-one setting, side by side, the one
// in force ringed. The toggle drawings (settings-illustrations.tsx) show a
// before and after with an arrow between; a choice has no before, so these
// are peers in a row with no arrow.
//
// Traced off the real editor at 1280x800 like the toggle drawings: a drawing
// that doesn't match the app is worse than none.

export type ChoiceIllustrationId = 'appearance';

type ChoiceDrawing = {
  // In the order the row offers its options. Keyed by option id so the ring
  // follows the value, and so a test can check every option is drawn.
  states: { id: string; caption: string; art: ReactNode }[];
  label: string;
  // Keep every state at full strength (see StateFrame's `fade`).
  fullColour?: boolean;
};

// --- Appearance (docs/specs/007-editor/live-app.md) --------------------------------------------------

// The editor in a FIXED mode. Unlike Window these colours do not follow the
// dialog's own light / dark mode: the drawing is of the mode, so the dark one
// stays dark while you look at it in light mode and vice versa.
function ModeWindow({ dark }: { dark: boolean }) {
  const paper = dark ? 'fill-slate-900 stroke-slate-600' : 'fill-white stroke-slate-300';
  const chrome = dark ? 'fill-slate-800 stroke-slate-600' : 'fill-slate-100 stroke-slate-300';
  const panel = dark ? 'fill-slate-800 stroke-slate-600' : 'fill-slate-50 stroke-slate-300';
  const ink = dark ? 'fill-slate-600' : 'fill-slate-300';
  return (
    <g strokeWidth="1">
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="3.5" className={paper} />
      <rect x="0.5" y="0.5" width={W - 1} height="10" rx="3.5" className={chrome} />
      <rect x="0.5" y={H - 9.5} width={W - 1} height="9" className={chrome} />
      <rect x="5" y="14" width="26" height="34" rx="2.5" className={panel} />
      <rect x="9" y="19" width="16" height="3" rx="1.5" className={`${ink} stroke-none`} />
      <rect x="9" y="26" width="12" height="3" rx="1.5" className={`${ink} stroke-none`} />
      <rect
        x="44"
        y="22"
        width="22"
        height="13"
        rx="2"
        className="fill-sky-500/25 stroke-sky-500"
      />
      <rect
        x="72"
        y="34"
        width="18"
        height="11"
        rx="2"
        className="fill-sky-500/25 stroke-sky-500"
      />
    </g>
  );
}

// Follows the device: half light, half dark, split on the diagonal.
const SystemArt = (
  <g>
    <defs>
      <clipPath id="lvd-settings-system-dark">
        <path d={`M${W} 0V${H}H0Z`} />
      </clipPath>
    </defs>
    <ModeWindow dark={false} />
    <g clipPath="url(#lvd-settings-system-dark)">
      <ModeWindow dark />
    </g>
    <path d={`M${W - 1} 1L1 ${H - 1}`} className="stroke-slate-400" strokeWidth="0.8" />
  </g>
);

export const CHOICE_ILLUSTRATIONS: Record<ChoiceIllustrationId, ChoiceDrawing> = {
  appearance: {
    states: [
      { id: 'light', caption: 'Light', art: <ModeWindow dark={false} /> },
      { id: 'dark', caption: 'Dark', art: <ModeWindow dark /> },
      { id: 'system', caption: 'System', art: SystemArt },
    ],
    label:
      'The editor in light mode, in dark mode, and following the device, drawn half light and half dark.',
    fullColour: true,
  },
};

export function ChoiceStates({
  id,
  value,
  onPick,
  disabledIds = [],
}: {
  id: ChoiceIllustrationId;
  value: string;
  // Clicking a state picks it (see pickable); `disabledIds` can't be picked.
  onPick?: (id: string) => void;
  disabledIds?: readonly string[];
}) {
  const drawing = CHOICE_ILLUSTRATIONS[id];
  const n = drawing.states.length;
  // A tighter gap than the toggle pair's: there is no arrow to fit between.
  const gap = GAP / 2;
  const width = W * n + gap * (n - 1) + 8;
  return (
    <svg
      viewBox={`-4 -4 ${width} ${H + 22}`}
      // Capped so each frame draws at the toggle pair's size, whatever the
      // option count: two options stay as small as a toggle's two states.
      style={{ maxWidth: `${(width * REM_PER_UNIT).toFixed(2)}rem` }}
      className="h-auto w-full"
      fill="none"
      role="img"
      aria-label={drawing.label}
    >
      {drawing.states.map((state, i) => (
        <g
          key={state.id}
          transform={`translate(${i * (W + gap)} 0)`}
          {...pickable(
            onPick ? () => onPick(state.id) : undefined,
            state.id !== value && !disabledIds.includes(state.id),
          )}
        >
          <StateFrame
            art={state.art}
            caption={state.caption}
            current={state.id === value}
            fade={!drawing.fullColour}
          />
        </g>
      ))}
    </svg>
  );
}
