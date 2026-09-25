import type { ReactNode } from 'react';
import {
  CHOICE_ILLUSTRATIONS,
  ChoiceStates,
  type ChoiceIllustrationId,
} from './settings-choice-illustrations';
import {
  GAP,
  H,
  PANEL,
  PAPER,
  SHAPE,
  StateFrame,
  W,
  Window,
  pickable,
} from './settings-illustration-kit';

// Small before/after drawings for the settings whose effect is VISUAL, the
// ones whose four-line description is really trying to describe a picture. A
// reader deciding whether they want Minimal Panel Layout wants to see the two
// layouts, not read about floating panels being replaced by a button bar.
//
// A drawing has to match the REAL editor or it is worse than no drawing, so
// these are traced off the app at 1280x800 rather than invented: the window
// has the header strip and the bottom tab bar, the Explorer fills the
// top-left, the Palette the top-right, and the minimal layout's bar is ONE
// short horizontal row of three buttons in the top-right corner.
//
// Each drawing shows both states and RINGS the one currently in force, so the
// picture doubles as a readout of the switch beside it.
//
// Kept out of settings-catalogue.ts so that file stays plain data (.ts, no
// JSX): a row names an illustration by id and this registry draws it.

type ToggleIllustrationId = 'showMinimap' | 'alignmentGuides' | 'layerThumbnails' | 'mapDimOutside';

// Toggle drawings (a before / after pair, below) plus the one-per-option
// drawings for pick-one settings (settings-choice-illustrations.tsx).
export type SettingsIllustrationId = ToggleIllustrationId | ChoiceIllustrationId;

// Two states side by side, the live one ringed. The ring is what turns a
// diagram into a readout: glance at it and you know which way the switch is
// set without reading the switch.
function StatePair({
  off,
  on,
  active,
  labels = ['Off', 'On'],
  label,
  onPick,
}: {
  off: ReactNode;
  on: ReactNode;
  active: boolean;
  // Clicking a half sets the switch to it (see pickable).
  onPick?: (on: boolean) => void;
  labels?: [string, string];
  label: string;
}) {
  const halves: [ReactNode, string, boolean][] = [
    [off, labels[0], !active],
    [on, labels[1], active],
  ];
  return (
    <svg
      viewBox={`-4 -4 ${W * 2 + GAP + 8} ${H + 22}`}
      className="h-auto w-full max-w-[17rem]"
      fill="none"
      role="img"
      aria-label={label}
    >
      {halves.map(([art, caption, current], i) => (
        <g
          key={caption}
          transform={`translate(${i * (W + GAP)} 0)`}
          {...pickable(onPick ? () => onPick(i === 1) : undefined, !current)}
        >
          <StateFrame art={art} caption={caption} current={current} />
        </g>
      ))}
      <path
        d={`M${W + 4} ${H / 2}h${GAP - 8}m0 0-3-3m3 3-3 3`}
        className="stroke-slate-400 dark:stroke-slate-500"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// --- Show minimap ---------------------------------------------------------

const CanvasShapes = (
  <>
    <rect x="40" y="20" width="20" height="11" rx="2" className={SHAPE} strokeWidth="1" />
    <rect x="66" y="34" width="16" height="10" rx="2" className={SHAPE} strokeWidth="1" />
  </>
);

const NoMapArt = <Window>{CanvasShapes}</Window>;

const MapArt = (
  <Window>
    {CanvasShapes}
    <rect x="5" y={H - 30} width="26" height="18" rx="2" className={PANEL} strokeWidth="1" />
    <rect
      x="9"
      y={H - 27}
      width="12"
      height="8"
      rx="1"
      className="fill-none stroke-brand-500"
      strokeWidth="0.9"
    />
  </Window>
);

// --- Alignment guides -----------------------------------------------------

const NoGuidesArt = (
  <Window>
    <rect x="22" y="20" width="24" height="13" rx="2" className={SHAPE} strokeWidth="1" />
    {/* The dragged shape, a few pixels off the one above it. */}
    <rect
      x="26"
      y="40"
      width="24"
      height="13"
      rx="2"
      className="fill-brand-500/20 stroke-brand-500/70"
      strokeWidth="1"
    />
  </Window>
);

const GuidesArt = (
  <Window>
    <rect x="22" y="20" width="24" height="13" rx="2" className={SHAPE} strokeWidth="1" />
    <rect
      x="22"
      y="40"
      width="24"
      height="13"
      rx="2"
      className="fill-brand-500/20 stroke-brand-500/70"
      strokeWidth="1"
    />
    {/* The snap line the setting is named for. */}
    <path
      d="M22 15v40M46 15v40"
      className="stroke-rose-400"
      strokeWidth="0.9"
      strokeDasharray="2.5 2"
    />
  </Window>
);

// --- Layer thumbnails -----------------------------------------------------

// A Layers panel rather than the whole window: the setting dresses rows in
// one panel, so drawing the editor around it would bury the difference.
function LayerRows({ thumbs }: { thumbs: boolean }) {
  return (
    <g strokeWidth="1">
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="3.5" className={PAPER} />
      {[0, 1, 2].map((i) => {
        const y = 8 + i * 18;
        return (
          <g key={i}>
            {thumbs ? (
              <rect x="7" y={y} width="16" height="12" rx="2" className={PANEL} strokeWidth="1" />
            ) : null}
            <rect
              x={thumbs ? 28 : 7}
              y={y + 2}
              width={thumbs ? 40 : 52}
              height="3.5"
              rx="1.75"
              className="fill-slate-300 stroke-none dark:fill-slate-600"
            />
            <rect
              x={thumbs ? 28 : 7}
              y={y + 8}
              width={thumbs ? 26 : 34}
              height="2.5"
              rx="1.25"
              className="fill-slate-200 stroke-none dark:fill-slate-700"
            />
          </g>
        );
      })}
    </g>
  );
}

// --- Dim outside the view -------------------------------------------------

// The minimap on its own, filling the frame: at editor scale the dimming is
// a few pixels and invisible.
function MiniMapArt({ dim }: { dim: boolean }) {
  return (
    <g strokeWidth="1">
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="3.5" className={PAPER} />
      <rect x="14" y="12" width="22" height="13" rx="2" className={SHAPE} strokeWidth="1" />
      <rect x="52" y="34" width="26" height="14" rx="2" className={SHAPE} strokeWidth="1" />
      {dim ? (
        // Everything outside the viewport rectangle, shaded.
        <path
          d={`M0.5 0.5h${W - 1}v${H - 1}h${-(W - 1)}Z M26 18h44v28h-44Z`}
          fillRule="evenodd"
          className="fill-slate-900/25 stroke-none dark:fill-slate-950/45"
        />
      ) : null}
      <rect
        x="26"
        y="18"
        width="44"
        height="28"
        rx="2"
        className="fill-none stroke-brand-500"
        strokeWidth="1.2"
      />
    </g>
  );
}

// --- Registry -------------------------------------------------------------

type Drawing = { off: ReactNode; on: ReactNode; labels?: [string, string]; label: string };

const ILLUSTRATIONS: Record<ToggleIllustrationId, Drawing> = {
  showMinimap: {
    off: NoMapArt,
    on: MapArt,
    label:
      'The editor without the minimap, and with a small canvas overview in the bottom-left corner.',
  },
  alignmentGuides: {
    off: NoGuidesArt,
    on: GuidesArt,
    label:
      'Two shapes being lined up: without guides the lower one sits slightly off, with guides a dashed snap line brings its edges level.',
  },
  layerThumbnails: {
    off: <LayerRows thumbs={false} />,
    on: <LayerRows thumbs />,
    label: 'Layer rows as plain names, and the same rows each led by a small preview thumbnail.',
  },
  mapDimOutside: {
    off: <MiniMapArt dim={false} />,
    on: <MiniMapArt dim />,
    label:
      'The minimap with the viewport rectangle alone, and with everything outside that rectangle shaded.',
  },
};

export function SettingsIllustration({
  id,
  active = false,
  value = '',
  onToggle,
  onChoose,
  disabledValues,
}: {
  id: SettingsIllustrationId;
  // Toggle drawings: which half is in force, so the drawing rings it.
  active?: boolean;
  // Choice drawings: the option in force, likewise ringed.
  value?: string;
  // Clicking a state picks it: a toggle's half, or a choice's option (except
  // `disabledValues`, the ones that can't be picked right now).
  onToggle?: (on: boolean) => void;
  onChoose?: (value: string) => void;
  disabledValues?: readonly string[];
}) {
  if (isChoiceIllustration(id)) {
    return (
      <div className="mt-2.5 px-3.5">
        <ChoiceStates id={id} value={value} onPick={onChoose} disabledIds={disabledValues} />
      </div>
    );
  }
  const drawing = ILLUSTRATIONS[id];
  return (
    <div className="mt-2.5 px-3.5">
      <StatePair
        off={drawing.off}
        on={drawing.on}
        active={active}
        labels={drawing.labels}
        label={drawing.label}
        onPick={onToggle}
      />
    </div>
  );
}

function isChoiceIllustration(id: SettingsIllustrationId): id is ChoiceIllustrationId {
  return id in CHOICE_ILLUSTRATIONS;
}
