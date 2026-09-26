import type { ReactNode } from 'react';
import { GAP, H, PANEL, StateFrame, W, Window, pickable } from './settings-illustration-kit';

// One small drawing per OPTION of a pick-one setting, side by side, the one
// in force ringed. The toggle drawings (settings-illustrations.tsx) show a
// before and after with an arrow between; a choice has no before, so these
// are peers in a row with no arrow.
//
// Traced off the real editor at 1280x800 like the toggle drawings: a drawing
// that doesn't match the app is worse than none.

export type ChoiceIllustrationId = 'panelLayout' | 'appearance';

type ChoiceDrawing = {
  // In the order the row offers its options. Keyed by option id so the ring
  // follows the value, and so a test can check every option is drawn.
  states: { id: string; caption: string; art: ReactNode }[];
  label: string;
  // Keep every state at full strength (see StateFrame's `fade`).
  fullColour?: boolean;
};

// --- Panel layout (docs/specs/008-canvas/canvas-and-palette.md, docs/specs/007-editor/toolbar-layout.md) --------------------------------------

const FloatingArt = (
  <Window>
    <rect x="5" y="14" width="26" height="34" rx="2.5" className={PANEL} strokeWidth="1" />
    <rect x={W - 31} y="14" width="26" height="34" rx="2.5" className={PANEL} strokeWidth="1" />
  </Window>
);

// The dock: one short row of buttons in the top-right corner.
const MinimalArt = (
  <Window>
    <rect x={W - 39} y="14" width="34" height="11" rx="2.5" className={PANEL} strokeWidth="1" />
    <path
      d={`M${W - 28} 14v11M${W - 17} 14v11`}
      className="stroke-brand-500/60"
      strokeWidth="0.8"
    />
  </Window>
);

// The strip across the top centre, the menu button in the top-left corner,
// and the Floating layout's Layers button kept in the bottom row.
const ToolbarArt = (
  <Window>
    <rect x="5" y="14" width="9" height="9" rx="2" className={PANEL} strokeWidth="1" />
    <rect x={W / 2 - 25} y="14" width="50" height="9" rx="2.5" className={PANEL} strokeWidth="1" />
    <path
      d={`M${W / 2 - 17} 16.5v4M${W / 2 - 9} 16.5v4M${W / 2 - 1} 16.5v4M${W / 2 + 7} 16.5v4M${W / 2 + 15} 16.5v4`}
      className="stroke-brand-500/60"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
    <rect x={W - 14} y={H - 21} width="9" height="8" rx="2" className={PANEL} strokeWidth="1" />
  </Window>
);

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
  panelLayout: {
    states: [
      { id: 'floating', caption: 'Floating', art: FloatingArt },
      { id: 'minimal', caption: 'Minimal', art: MinimalArt },
      { id: 'toolbar', caption: 'Toolbar', art: ToolbarArt },
    ],
    label:
      'The three panel layouts: Floating, with the Explorer and Palette panels over the canvas; Minimal, with both collapsed into a short button bar in the top-right corner; and Toolbar, with the Palette as a strip across the top and a menu button in the top-left.',
  },
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
  return (
    <svg
      viewBox={`-4 -4 ${W * n + gap * (n - 1) + 8} ${H + 22}`}
      className="h-auto w-full max-w-[24rem]"
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
