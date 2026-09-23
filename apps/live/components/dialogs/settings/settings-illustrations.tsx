import type { ReactNode } from 'react';

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

export type SettingsIllustrationId =
  'minimalPanels' | 'showMinimap' | 'alignmentGuides' | 'layerThumbnails' | 'mapDimOutside';

const W = 104;
const H = 66;
const GAP = 18;

const PAPER = 'fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-600';
const CHROME = 'fill-slate-100 stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600';
const PANEL = 'fill-brand-500/20 stroke-brand-500/70';
const SHAPE = 'fill-slate-200 stroke-slate-400 dark:fill-slate-700 dark:stroke-slate-500';

// The editor window: the header strip and bottom tab bar both layouts keep.
// Drawing them is what makes the halves read as the same app twice rather
// than two unrelated boxes.
function Window({ children }: { children?: ReactNode }) {
  return (
    <g strokeWidth="1">
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="3.5" className={PAPER} />
      <path d={`M0.5 10.5h${W - 1}`} className="stroke-slate-300 dark:stroke-slate-600" />
      <rect x="0.5" y={H - 9.5} width={W - 1} height="9" className={CHROME} />
      <rect
        x="5"
        y={H - 7}
        width="16"
        height="4"
        rx="1.5"
        className="fill-brand-500/40 stroke-none"
      />
      {children}
    </g>
  );
}

// Two states side by side, the live one ringed. The ring is what turns a
// diagram into a readout: glance at it and you know which way the switch is
// set without reading the switch.
function StatePair({
  off,
  on,
  active,
  labels = ['Off', 'On'],
  label,
}: {
  off: ReactNode;
  on: ReactNode;
  active: boolean;
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
        <g key={caption} transform={`translate(${i * (W + GAP)} 0)`}>
          {current ? (
            <rect
              x="-3.5"
              y="-3.5"
              width={W + 7}
              height={H + 7}
              rx="6"
              className="fill-brand-500/5 stroke-brand-500"
              strokeWidth="1.5"
            />
          ) : null}
          <g className={current ? '' : 'opacity-60'}>{art}</g>
          <text
            x={W / 2}
            y={H + 13}
            textAnchor="middle"
            className={
              current
                ? 'fill-brand-600 text-[8px] font-semibold dark:fill-brand-300'
                : 'fill-slate-400 text-[8px] dark:fill-slate-500'
            }
          >
            {caption}
          </text>
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

// --- Minimal panel layout -------------------------------------------------

const FloatingArt = (
  <Window>
    <rect x="5" y="14" width="26" height="34" rx="2.5" className={PANEL} strokeWidth="1" />
    <rect x={W - 31} y="14" width="26" height="34" rx="2.5" className={PANEL} strokeWidth="1" />
  </Window>
);

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

const ILLUSTRATIONS: Record<SettingsIllustrationId, Drawing> = {
  minimalPanels: {
    off: FloatingArt,
    on: MinimalArt,
    label:
      'The editor with Minimal Panel Layout off, the Explorer and Palette panels floating over the canvas, and with it on, the two collapsed into a short button bar in the top-right corner.',
  },
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
  active,
}: {
  id: SettingsIllustrationId;
  // Which half is in force, so the drawing rings the current state.
  active: boolean;
}) {
  const drawing = ILLUSTRATIONS[id];
  return (
    <div className="mt-2.5 px-3.5">
      <StatePair
        off={drawing.off}
        on={drawing.on}
        active={active}
        labels={drawing.labels}
        label={drawing.label}
      />
    </div>
  );
}
