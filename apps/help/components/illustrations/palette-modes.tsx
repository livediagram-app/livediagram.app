// Palette-category illustrations (spec/55): the mode picker (Select, Hand,
// Eraser, Format Painter, Laser, Spotlight, Isometric) and the palette settings
// popover (Auto-Attach Arrows, Alignment Guides, Minimal Panels, Reset Palette
// Position). Composed only from the shared primitives so the house style holds.

import { useId } from 'react';
import { Scene, Shape, Arrow, SelectionBox, Panel, Tile, Label, Button } from './primitives';

// --- Mode glyphs ------------------------------------------------------------
//
// Small icons drawn at the tile's centre (the tile translates to its own
// origin). Kept here so the shared mode-row and the per-mode scenes draw the
// same glyph for each tool.

/** A pointer / arrow cursor glyph (Select). */
function SelectGlyph({ on = false }: { on?: boolean }) {
  return (
    <path
      d="M-5 -6 L4 2 L-1 2.5 L1.5 7 L-0.5 8 L-3 3.5 L-6 6 Z"
      className={on ? 'fill-white stroke-white' : 'fill-slate-500 stroke-slate-500'}
      strokeWidth={1}
      strokeLinejoin="round"
    />
  );
}

/** An open hand glyph (Hand / pan). */
function HandGlyph({ on = false }: { on?: boolean }) {
  return (
    <path
      d="M-4 4 v-7 a1.4 1.4 0 0 1 2.8 0 v5 m0 -1 a1.4 1.4 0 0 1 2.8 0 v1 m0 -1 a1.4 1.4 0 0 1 2.8 0 v3 a5 5 0 0 1 -5 5 h-1 a5 5 0 0 1 -4.4 -3 l-1.4 -3 a1.4 1.4 0 0 1 2.4 -1.4 l0.6 1"
      className={on ? 'stroke-white' : 'stroke-slate-500'}
      strokeWidth={1.5}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** An eraser block glyph. */
function EraserGlyph({ on = false }: { on?: boolean }) {
  return (
    <g
      className={on ? 'stroke-white' : 'stroke-slate-500'}
      strokeWidth={1.5}
      fill="none"
      strokeLinejoin="round"
    >
      <path d="M-6 4 L0 -2 a2 2 0 0 1 3 0 l3 3 a2 2 0 0 1 0 3 L4 6 H-2 Z" />
      <path d="M-2 6 L-6 2" />
    </g>
  );
}

/** A paint-roller / brush glyph (Format Painter). */
function PainterGlyph({ on = false }: { on?: boolean }) {
  return (
    <g>
      <rect
        x={-7}
        y={-7}
        width={14}
        height={8}
        rx={2}
        className={on ? 'fill-white' : 'fill-slate-400'}
      />
      <path d="M0 1 v3" className={on ? 'stroke-white' : 'stroke-slate-500'} strokeWidth={1.5} />
      <path
        d="M-3 4 h6 v4 h-6 Z"
        className={on ? 'fill-white/70 stroke-white' : 'fill-slate-300 stroke-slate-500'}
        strokeWidth={1.2}
      />
    </g>
  );
}

/** A laser-beam glyph (a dot with rays). */
function LaserGlyph({ on = false }: { on?: boolean }) {
  return (
    <g>
      <circle r={2.5} className={on ? 'fill-white' : 'fill-rose-500'} />
      <path
        d="M0 -8 v3 M0 5 v3 M-8 0 h3 M5 0 h3 M-5.6 -5.6 l2 2 M3.6 3.6 l2 2 M5.6 -5.6 l-2 2 M-3.6 3.6 l-2 2"
        className={on ? 'stroke-white' : 'stroke-rose-400'}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </g>
  );
}

/** A spotlight glyph (a bright ring with a dimmed surround). */
function SpotlightGlyph({ on = false }: { on?: boolean }) {
  return (
    <g>
      <circle
        r={6}
        className={on ? 'fill-none stroke-white' : 'fill-none stroke-slate-500'}
        strokeWidth={1.5}
      />
      <circle r={2} className={on ? 'fill-white' : 'fill-amber-400'} />
    </g>
  );
}

/** An isometric cube glyph. */
function IsometricGlyph({ on = false }: { on?: boolean }) {
  const cls = on ? 'stroke-white' : 'stroke-slate-500';
  return (
    <g className={cls} strokeWidth={1.4} fill="none" strokeLinejoin="round">
      <path d="M0 -7 L7 -3 L0 1 L-7 -3 Z" />
      <path d="M-7 -3 V4 L0 8 V1 M7 -3 V4 L0 8" />
    </g>
  );
}

const MODES = [
  { key: 'select', label: 'Select', Glyph: SelectGlyph },
  { key: 'hand', label: 'Hand', Glyph: HandGlyph },
  { key: 'eraser', label: 'Eraser', Glyph: EraserGlyph },
  { key: 'painter', label: 'Painter', Glyph: PainterGlyph },
  { key: 'laser', label: 'Laser', Glyph: LaserGlyph },
  { key: 'spotlight', label: 'Spot', Glyph: SpotlightGlyph },
  { key: 'isometric', label: 'Iso', Glyph: IsometricGlyph },
] as const;

type ModeKey = (typeof MODES)[number]['key'];

// --- Shared mode-row --------------------------------------------------------

/** The palette's tool-picker row: a horizontal strip of mode tiles with the
 *  active one brand-filled. Reused at the top of every mode scene so each
 *  article shows the same picker with its own tool lit. `x`/`y` place the row;
 *  `active` lights the matching tile. */
export function ModeRow({
  x = 24,
  y = 20,
  active,
  title = true,
}: {
  x?: number;
  y?: number;
  active: ModeKey;
  title?: boolean;
}) {
  const gap = 34;
  const tilesW = MODES.length * gap - (gap - 26);
  const panelW = tilesW + 28;
  const labelGap = title ? 26 : 0;
  return (
    <Panel x={x} y={y} w={panelW} h={43 + labelGap} title={title ? 'PALETTE' : undefined}>
      {MODES.map((m, i) => {
        const on = m.key === active;
        const tx = x + 14 + i * gap;
        const ty = y + labelGap + 7;
        return (
          <Tile key={m.key} x={tx} y={ty} active={on}>
            <m.Glyph on={on} />
          </Tile>
        );
      })}
    </Panel>
  );
}

// --- Mode scenes ------------------------------------------------------------

/** Select mode: the picker with Select lit and a shape selected with handles. */
export function SelectMode() {
  return (
    <Scene w={420} h={230}>
      <ModeRow active="select" />
      <Shape x={140} y={132} w={120} h={56} kind="rect" label="Step one" labelTone="strong" />
      <SelectionBox x={140} y={132} w={120} h={56} />
    </Scene>
  );
}

/** Hand mode: the picker with Hand lit and a grabbing-hand cursor panning the
 *  canvas (a faint drag trail behind it). */
export function HandMode() {
  return (
    <Scene w={420} h={230}>
      <ModeRow active="hand" />
      <Shape x={84} y={108} w={72} h={42} label="A" />
      <Shape x={252} y={150} w={72} h={42} accent label="B" />
      <Arrow from={[156, 129]} to={[252, 171]} kind="elbow" tone="muted" />
      {/* Drag trail */}
      <path
        d="M120 188 q40 -16 88 -8"
        className="stroke-slate-300"
        strokeWidth={2}
        fill="none"
        strokeDasharray="5 5"
        strokeLinecap="round"
      />
      {/* Grabbing-hand cursor */}
      <g transform="translate(196 150)">
        <path
          d="M0 6 v-8 a3 3 0 0 1 6 0 v6 m0 -2 a3 3 0 0 1 6 0 v3 m0 -1 a3 3 0 0 1 6 0 v5 a10 10 0 0 1 -10 10 h-2 a10 10 0 0 1 -9 -7 l-3 -7 a3 3 0 0 1 5 -3 l1 2"
          className="fill-white stroke-slate-500"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </Scene>
  );
}

/** Eraser mode: the picker with Eraser lit and a drag across shapes, the ones
 *  already swept fading away. */
export function EraserMode() {
  return (
    <Scene w={420} h={230}>
      <ModeRow active="eraser" />
      {/* Erased (fading) */}
      <Shape x={70} y={118} w={62} h={38} dashed fill="fill-slate-50" stroke="stroke-slate-300" />
      <Shape x={150} y={150} w={62} h={38} dashed fill="fill-slate-50" stroke="stroke-slate-300" />
      {/* Still present */}
      <Shape x={244} y={132} w={62} h={38} kind="circle" label="C" />
      <Shape x={320} y={172} w={62} h={38} accent label="D" />
      {/* Eraser drag path */}
      <path
        d="M96 132 L184 168 L276 150"
        className="stroke-rose-400"
        strokeWidth={2.5}
        fill="none"
        strokeDasharray="6 5"
        strokeLinecap="round"
      />
      {/* Eraser cursor */}
      <g transform="translate(276 150)">
        <rect
          x={-9}
          y={-5}
          width={18}
          height={11}
          rx={2}
          transform="rotate(-30)"
          className="fill-white stroke-slate-500"
          strokeWidth={1.8}
        />
        <rect
          x={-9}
          y={1}
          width={18}
          height={5}
          rx={1}
          transform="rotate(-30)"
          className="fill-rose-300 stroke-slate-500"
          strokeWidth={1.5}
        />
      </g>
    </Scene>
  );
}

/** Format Painter mode: the picker with Painter lit, copying one shape's style
 *  onto another via a brush cursor. */
export function FormatPainterMode() {
  return (
    <Scene w={420} h={220}>
      <ModeRow active="painter" />
      <Shape x={48} y={120} w={88} h={52} accent label="Source" />
      <Arrow from={[140, 146]} to={[252, 146]} kind="curved" tone="muted" dashed />
      <Shape x={262} y={120} w={88} h={52} accent label="Painted" />
      {/* Brush cursor */}
      <g transform="translate(196 166)">
        <rect x={-9} y={-9} width={18} height={11} rx={2} className="fill-brand-500" />
        <path d="M0 2 v8" className="stroke-slate-500" strokeWidth={2} />
        <path
          d="M-4 10 h8 v6 h-8 Z"
          className="fill-brand-300 stroke-slate-500"
          strokeWidth={1.5}
        />
      </g>
    </Scene>
  );
}

/** Laser mode: the picker with Laser lit and a fading laser trail across the
 *  canvas, brightening towards the cursor. */
export function LaserMode() {
  return (
    <Scene w={420} h={230}>
      <ModeRow active="laser" />
      <Shape x={84} y={120} w={76} h={44} label="A" />
      <Shape x={264} y={150} w={76} h={44} accent label="B" />
      {/* Fading laser trail: faint tail to bright head */}
      <path
        d="M104 176 q60 -40 140 -10 q30 12 56 -2"
        className="stroke-rose-200"
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M196 162 q30 12 56 -2 q20 -10 44 -4"
        className="stroke-rose-400"
        strokeWidth={3.5}
        fill="none"
        strokeLinecap="round"
      />
      {/* Bright head dot */}
      <circle cx={296} cy={156} r={5} className="fill-rose-500" />
      <circle cx={296} cy={156} r={9} className="fill-rose-400/30" />
    </Scene>
  );
}

/** Spotlight mode: the picker with Spotlight lit, the canvas dimmed except a
 *  bright circle around the cursor over one shape. */
export function SpotlightMode() {
  const hole = `spotlight-hole-${useId().replace(/:/g, '')}`;
  return (
    <Scene w={420} h={230}>
      <defs>
        <mask id={hole}>
          <rect x={0} y={0} width={420} height={230} fill="white" />
          <circle cx={232} cy={150} r={52} fill="black" />
        </mask>
      </defs>
      <ModeRow active="spotlight" />
      {/* Shapes underneath */}
      <Shape x={80} y={120} w={72} h={42} label="A" />
      <Shape x={196} y={128} w={72} h={42} accent label="B" />
      <Shape x={312} y={160} w={72} h={42} kind="circle" label="C" />
      {/* Dimming veil with a hole over the focused shape */}
      <rect
        x={0}
        y={96}
        width={420}
        height={134}
        className="fill-slate-900/55"
        mask={`url(#${hole})`}
      />
      {/* Bright ring around the cursor */}
      <circle cx={232} cy={150} r={52} className="fill-none stroke-amber-300" strokeWidth={2} />
      {/* Cursor at the centre of the spotlight */}
      <g transform="translate(238 156)">
        <path
          d="M0 0 L0 14 L4 10.6 L6.2 15.6 L8.8 14.4 L6.6 9.4 L11.4 9 Z"
          className="fill-white stroke-slate-700"
          strokeWidth={1}
        />
      </g>
    </Scene>
  );
}

/** Isometric mode: the picker with Iso lit and the same shapes tilted into an
 *  isometric, three-dimensional view. */
export function IsometricMode() {
  // Project flat (cx, cy) onto a simple isometric plane around a centre.
  const ox = 236;
  const oy = 168;
  const iso = (cx: number, cy: number): [number, number] => [
    ox + (cx - cy) * 0.86,
    oy + (cx + cy) * 0.5,
  ];
  // Draw an isometric "card" (a top face) for a flat box centred at (cx, cy).
  function IsoCard({
    cx,
    cy,
    half = 36,
    accent = false,
    label,
  }: {
    cx: number;
    cy: number;
    half?: number;
    accent?: boolean;
    label?: string;
  }) {
    const tl = iso(cx - half, cy - half * 0.55);
    const tr = iso(cx + half, cy - half * 0.55);
    const br = iso(cx + half, cy + half * 0.55);
    const bl = iso(cx - half, cy + half * 0.55);
    const c = iso(cx, cy);
    const d = `M${tl[0]} ${tl[1]} L${tr[0]} ${tr[1]} L${br[0]} ${br[1]} L${bl[0]} ${bl[1]} Z`;
    // A short extruded side for depth.
    const side = `M${bl[0]} ${bl[1]} L${br[0]} ${br[1]} L${br[0]} ${br[1] + 12} L${bl[0]} ${bl[1] + 12} Z`;
    return (
      <g>
        <path
          d={side}
          className={accent ? 'fill-brand-600 stroke-brand-700' : 'fill-slate-200 stroke-slate-300'}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <path
          d={d}
          className={accent ? 'fill-brand-500 stroke-brand-600' : 'fill-white stroke-brand-300'}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {label && (
          <Label
            x={c[0]}
            y={c[1]}
            anchor="middle"
            size={11}
            weight={600}
            tone={accent ? 'onAccent' : 'strong'}
          >
            {label}
          </Label>
        )}
      </g>
    );
  }
  const a = iso(-70, -30);
  const b = iso(70, 30);
  return (
    <Scene w={420} h={264}>
      <ModeRow active="isometric" />
      <line
        x1={a[0]}
        y1={a[1] + 6}
        x2={b[0]}
        y2={b[1] + 6}
        className="stroke-brand-400"
        strokeWidth={2.5}
      />
      <IsoCard cx={-70} cy={-30} label="A" />
      <IsoCard cx={70} cy={30} accent label="B" />
    </Scene>
  );
}

// --- Palette settings popover -----------------------------------------------

/** The palette gear (settings) popover: a small menu of toggle rows and the
 *  reset action. `highlight` brand-tints one row so an article can point at its
 *  own setting. Reused across the settings articles. */
export function PaletteSettings({
  highlight,
}: {
  highlight?: 'auto-attach' | 'guides' | 'quick-add' | 'panel-opacity' | 'minimal' | 'reset';
}) {
  // `slider` rows draw a mini opacity track instead of a toggle (Panel
  // opacity); the order mirrors the real popover.
  const rows: {
    key: 'auto-attach' | 'guides' | 'quick-add' | 'panel-opacity' | 'minimal';
    label: string;
    slider: boolean;
    on: boolean;
  }[] = [
    { key: 'auto-attach', label: 'Auto-attach arrows', slider: false, on: true },
    { key: 'guides', label: 'Alignment guides', slider: false, on: true },
    { key: 'quick-add', label: 'Quick-add on hover', slider: false, on: true },
    { key: 'panel-opacity', label: 'Panel opacity', slider: true, on: true },
    { key: 'minimal', label: 'Minimal panels', slider: false, on: false },
  ];
  return (
    <Scene w={400} h={302} bg="plain">
      <Panel x={92} y={26} w={216} h={250} title="PALETTE SETTINGS">
        {rows.map((r, i) => {
          const ry = 70 + i * 34;
          const hot = highlight === r.key;
          return (
            <g key={r.key}>
              {hot && (
                <rect
                  x={100}
                  y={ry - 12}
                  width={200}
                  height={28}
                  rx={7}
                  className="fill-brand-50"
                />
              )}
              <Label
                x={108}
                y={ry + 2}
                size={10}
                weight={hot ? 600 : 400}
                tone={hot ? 'accent' : 'body'}
              >
                {r.label}
              </Label>
              {r.slider ? (
                // Mini opacity slider, filled ~70%.
                <g transform={`translate(224 ${ry + 2})`}>
                  <rect x={0} y={-2} width={68} height={4} rx={2} className="fill-slate-200" />
                  <rect x={0} y={-2} width={47} height={4} rx={2} className="fill-brand-500" />
                  <circle
                    cx={47}
                    cy={0}
                    r={6}
                    className="fill-white stroke-brand-500"
                    strokeWidth={2}
                  />
                </g>
              ) : (
                // Toggle switch
                <g transform={`translate(${262} ${ry - 6})`}>
                  <rect
                    width={30}
                    height={16}
                    rx={8}
                    className={r.on ? 'fill-brand-500' : 'fill-slate-300'}
                  />
                  <circle cx={r.on ? 22 : 8} cy={8} r={6} className="fill-white" />
                </g>
              )}
            </g>
          );
        })}
        {/* Reset action */}
        <line x1={100} y1={236} x2={300} y2={236} className="stroke-slate-200" strokeWidth={1.5} />
        <Button
          x={108}
          y={244}
          w={184}
          h={22}
          label="Reset palette position"
          variant={highlight === 'reset' ? 'primary' : 'default'}
        />
      </Panel>
    </Scene>
  );
}

/** Quick-add on hover: hovering an element's "+" opens its quick-add menu
 *  (Duplicate / Arrow / Pencil / Text) without a click. A cursor rests on the
 *  + with the menu unfolded beside it. */
export function QuickAddOnHover() {
  return (
    <Scene w={400} h={216}>
      <Shape x={56} y={82} w={104} h={58} accent label="Idea" />
      {/* The menu unfolded to the right of the + (four option tiles). */}
      <rect
        x={210}
        y={92}
        width={150}
        height={40}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={222 + i * 34}
          y={104}
          width={26}
          height={16}
          rx={4}
          className="fill-slate-100"
        />
      ))}
      {/* The + button on the shape's right edge. */}
      <circle cx={184} cy={112} r={13} className="fill-white stroke-slate-200" strokeWidth={2} />
      <path
        d="M184 105.5v13M177.5 112h13"
        className="stroke-brand-500"
        strokeWidth={2}
        strokeLinecap="round"
      />
      {/* Cursor resting on the + (hovering, no click). */}
      <g transform="translate(186 112)">
        <path
          d="M0 0 L0 15 L4.2 11 L6.6 16.2 L9.2 15 L6.8 9.8 L12 9.4 Z"
          className="fill-white stroke-slate-700"
          strokeWidth={1}
        />
      </g>
    </Scene>
  );
}

/** Panel opacity: a floating panel rendered translucent so the canvas content
 *  behind it stays visible. Pairs with the settings popover illustration to
 *  show what the slider does. */
export function PanelOpacity() {
  return (
    <Scene w={400} h={240}>
      {/* Canvas content the panel floats over. */}
      <Shape x={54} y={104} w={86} h={52} accent label="A" />
      <Shape x={150} y={158} w={86} h={52} kind="circle" label="B" />
      <Shape x={252} y={150} w={92} h={52} label="C" />
      {/* The floating panel at ~60% opacity: the shapes behind it stay
          visible through it. */}
      <g opacity={0.6}>
        <Panel x={196} y={42} w={156} h={150} title="PALETTE">
          <rect x={210} y={78} width={128} height={10} rx={5} className="fill-slate-200" />
          <rect x={210} y={100} width={36} height={32} rx={6} className="fill-slate-100" />
          <rect x={252} y={100} width={36} height={32} rx={6} className="fill-slate-100" />
          <rect x={294} y={100} width={36} height={32} rx={6} className="fill-slate-100" />
          <rect x={210} y={144} width={128} height={10} rx={5} className="fill-slate-200" />
          <rect x={210} y={162} width={86} height={10} rx={5} className="fill-slate-200" />
        </Panel>
      </g>
    </Scene>
  );
}

/** Auto-attach arrows: an arrow re-pinning to the nearest face of a shape after
 *  the shape has moved (ghost at the old spot, solid at the new). */
export function AutoAttachArrows() {
  return (
    <Scene w={420} h={220}>
      <Shape x={48} y={92} w={88} h={48} label="Source" />
      {/* Old position (ghost) and the arrow that used to point there */}
      <Shape x={210} y={48} w={88} h={48} dashed fill="fill-slate-50" stroke="stroke-slate-300" />
      <Arrow from={[136, 116]} to={[210, 72]} tone="muted" dashed />
      {/* Moved shape, arrow re-pinned to its nearest face */}
      <Shape x={252} y={132} w={88} h={48} accent label="Target" />
      <Arrow from={[136, 116]} to={[252, 156]} kind="curved" tone="accent" />
      {/* Move trail */}
      <path
        d="M254 72 q40 30 30 60"
        className="stroke-slate-300"
        strokeWidth={2}
        fill="none"
        strokeDasharray="5 5"
        strokeLinecap="round"
      />
    </Scene>
  );
}

/** Alignment guides: snap lines appearing while a shape is dragged into line
 *  with the edges and centres of its neighbours. */
export function AlignmentGuides() {
  return (
    <Scene w={420} h={220}>
      <Shape x={60} y={48} w={72} h={40} label="A" />
      <Shape x={60} y={148} w={72} h={40} label="B" />
      {/* Dragged shape, lining up */}
      <Shape x={240} y={98} w={72} h={40} accent label="C" />
      <SelectionBox x={240} y={98} w={72} h={40} />
      {/* Vertical centre guide (aligns left-edge column) */}
      <line
        x1={96}
        y1={20}
        x2={96}
        y2={200}
        className="stroke-rose-400"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
      {/* Horizontal centre guide through the dragged shape */}
      <line
        x1={20}
        y1={118}
        x2={400}
        y2={118}
        className="stroke-rose-400"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
      {/* Left-edge alignment guide for the dragged shape */}
      <line
        x1={240}
        y1={20}
        x2={240}
        y2={200}
        className="stroke-rose-400"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
    </Scene>
  );
}

/** Minimal panels: floating panels (off) versus a compact button bar (on),
 *  shown before and after. */
export function MinimalPanels() {
  const uid = useId().replace(/:/g, '');
  const gridBefore = `grid-mp-${uid}`;
  const gridAfter = `grid-mp2-${uid}`;
  return (
    <Scene w={420} h={210} bg="none">
      {/* Before: floating panels on the canvas */}
      <g>
        <rect
          x={16}
          y={20}
          width={186}
          height={170}
          rx={10}
          fill={`url(#${gridBefore})`}
          className="stroke-slate-200"
          strokeWidth={2}
        />
        <defs>
          <pattern id={gridBefore} width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" className="fill-slate-200" />
          </pattern>
        </defs>
        <Panel x={28} y={32} w={74} h={48} title="EXPLORER" />
        <Panel x={120} y={30} w={70} h={70} title="PALETTE" />
        <Panel x={112} y={120} w={76} h={58} title="EDITOR" />
        <Label x={108} y={200} size={9} weight={700} anchor="middle" tone="muted">
          Floating panels
        </Label>
      </g>
      {/* After: compact dock */}
      <g>
        <rect
          x={218}
          y={20}
          width={186}
          height={170}
          rx={10}
          fill={`url(#${gridAfter})`}
          className="stroke-slate-200"
          strokeWidth={2}
        />
        <defs>
          <pattern id={gridAfter} width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" className="fill-slate-200" />
          </pattern>
        </defs>
        {/* Compact button bar / dock down the left edge */}
        <rect
          x={228}
          y={42}
          width={28}
          height={126}
          rx={9}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        {[0, 1, 2, 3].map((i) => (
          <Tile key={i} x={231} y={50 + i * 30} size={22} active={i === 1}>
            <rect
              x={-5}
              y={-5}
              width={10}
              height={10}
              rx={2}
              className={i === 1 ? 'stroke-white' : 'stroke-slate-400'}
              strokeWidth={1.6}
              fill="none"
            />
          </Tile>
        ))}
        {/* Popover opening from a dock button */}
        <Panel x={268} y={66} w={90} h={64} title="PALETTE" />
        <Label x={311} y={200} size={9} weight={700} anchor="middle" tone="accent">
          Compact dock
        </Label>
      </g>
    </Scene>
  );
}

/** Reset palette position: the palette snapping back from a drifted spot to its
 *  default top-right corner. */
export function ResetPalettePosition() {
  return (
    <Scene w={420} h={230}>
      {/* Drifted ghost of the palette */}
      <g opacity={0.5}>
        <rect
          x={120}
          y={132}
          width={70}
          height={84}
          rx={10}
          className="fill-white stroke-slate-300"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
      </g>
      {/* Snap-back trail */}
      <Arrow from={[190, 150]} to={[316, 44]} kind="curved" tone="accent" dashed />
      {/* Palette back in its default top-right corner */}
      <Panel x={318} y={20} w={84} h={104} title="PALETTE">
        <Tile x={328} y={48} active>
          <SelectGlyph on />
        </Tile>
        <Tile x={362} y={48}>
          <HandGlyph />
        </Tile>
        <Tile x={328} y={84}>
          <EraserGlyph />
        </Tile>
        <Tile x={362} y={84}>
          <LaserGlyph />
        </Tile>
      </Panel>
      <Label x={252} y={92} size={10} weight={700} tone="accent" anchor="middle">
        Snap back
      </Label>
    </Scene>
  );
}
