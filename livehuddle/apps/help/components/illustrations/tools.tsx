// Tools-category illustrations (docs/specs/018-help/help-app.md): light/dark mode, and Layout Cleanup's Auto-Align.
// Composed only from the shared primitives so the house style holds.

import { Scene, Shape, Arrow, Label, TextBar } from '@liveworkspace/help-site/art/primitives';

// --- Light / dark mode ------------------------------------------------------

/** The sun glyph the Light setting shows, drawn from its centre. */
function SunGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={3.5} className="fill-none stroke-slate-600" strokeWidth={1.5} />
      <path
        d="M0 -7.5 v2 M0 5.5 v2 M-7.5 0 h2 M5.5 0 h2 M-5.3 -5.3 l1.4 1.4 M3.9 3.9 l1.4 1.4 M5.3 -5.3 l-1.4 1.4 M-3.9 3.9 l-1.4 1.4"
        className="stroke-slate-600"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </g>
  );
}

/** The moon glyph the Dark setting shows. */
function MoonGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M3 -6 a6.5 6.5 0 1 0 3.5 10 a7 7 0 0 1 -3.5 -10 Z"
        className="fill-none stroke-slate-600"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </g>
  );
}

/** The monitor glyph the System setting shows. */
function MonitorGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        x={-7}
        y={-6}
        width={14}
        height={9.5}
        rx={1.5}
        className="fill-none stroke-slate-600"
        strokeWidth={1.5}
      />
      <path d="M-3 6.5 h6 M0 3.5 v3" className="stroke-slate-600" strokeWidth={1.5} />
    </g>
  );
}

/** One labelled chrome button (glyph + text) as the tab bar draws it. */
function ChromeButton({
  x,
  y,
  w,
  label,
  glyph,
  on = false,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  glyph?: 'sun' | 'moon' | 'monitor';
  on?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={26}
        rx={7}
        className={on ? 'fill-brand-50 stroke-brand-300' : 'fill-white stroke-slate-200'}
        strokeWidth={1.5}
      />
      {glyph === 'sun' && <SunGlyph x={x + 15} y={y + 13} />}
      {glyph === 'moon' && <MoonGlyph x={x + 15} y={y + 13} />}
      {glyph === 'monitor' && <MonitorGlyph x={x + 15} y={y + 13} />}
      <Label
        x={glyph ? x + 27 : x + w / 2}
        y={y + 14}
        size={11}
        weight={600}
        anchor={glyph ? 'start' : 'middle'}
      >
        {label}
      </Label>
    </g>
  );
}

/** The Appearance button in the tab bar's right-hand cluster, beside Search
 *  and Settings, and the Light → Dark → System cycle each click steps through. */
export function LightDarkToggle() {
  return (
    <Scene w={420} h={210} bg="canvas">
      {/* The tab bar along the bottom of the editor. */}
      <rect
        x={0}
        y={150}
        width={420}
        height={44}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      <rect
        x={14}
        y={159}
        width={70}
        height={26}
        rx={7}
        className="fill-brand-500 stroke-brand-600"
        strokeWidth={1.5}
      />
      <Label x={49} y={173} size={11} weight={600} anchor="middle" tone="onAccent">
        Tab 1
      </Label>
      <ChromeButton x={190} y={159} w={66} label="Search" />
      <ChromeButton x={262} y={159} w={70} label="Settings" />
      <ChromeButton x={338} y={159} w={70} label="Light" glyph="sun" />
      {/* The cycle each click walks through. */}
      <ChromeButton x={58} y={44} w={74} label="Light" glyph="sun" on />
      <Arrow from={[138, 57]} to={[168, 57]} tone="muted" />
      <ChromeButton x={174} y={44} w={72} label="Dark" glyph="moon" />
      <Arrow from={[252, 57]} to={[282, 57]} tone="muted" />
      <ChromeButton x={288} y={44} w={84} label="System" glyph="monitor" />
      <path
        d="M330 76 V96 H95 V82"
        fill="none"
        className="stroke-slate-300"
        strokeWidth={2}
        strokeDasharray="5 4"
        strokeLinecap="round"
      />
      <path d="M90 84 L95 76 L100 84 Z" className="fill-slate-300" />
      <Label x={212} y={110} size={10} tone="muted" anchor="middle">
        Each click moves to the next setting
      </Label>
    </Scene>
  );
}

// --- Layout cleanup ---------------------------------------------------------

/** Before/after for Auto-align: a scattered, mis-sized handful of sticky notes snapped into neat rows on the grid. */
export function CleanupBeforeAfter() {
  // [x, y, w, h, fill] before, then the same notes after: sizes rounded to the grid, edges shared.
  const before: [number, number, number, number, string][] = [
    [26, 40, 58, 52, 'fill-amber-100'],
    [96, 34, 64, 56, 'fill-emerald-100'],
    [30, 112, 62, 50, 'fill-rose-100'],
    [104, 118, 56, 58, 'fill-violet-100'],
  ];
  const after: [number, number, number, number, string][] = [
    [246, 44, 60, 56, 'fill-amber-100'],
    [326, 44, 60, 56, 'fill-emerald-100'],
    [246, 120, 60, 56, 'fill-rose-100'],
    [326, 120, 60, 56, 'fill-violet-100'],
  ];
  const note = ([x, y, w, h, fill]: [number, number, number, number, string], i: number) => (
    <g key={i}>
      {/* Square corners and no border, as a sticky draws by default. */}
      <rect x={x} y={y} width={w} height={h} className={fill} />
      <rect x={x} y={y} width={w} height={h} className="fill-slate-900/5" />
      <TextBar x={x + 9} y={y + 16} w={w - 22} />
      <TextBar x={x + 9} y={y + 28} w={w - 30} tone="faint" />
    </g>
  );
  return (
    <Scene w={420} h={220}>
      {before.map(note)}
      {/* Divider */}
      <line
        x1={210}
        y1={28}
        x2={210}
        y2={192}
        className="stroke-slate-200"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
      {after.map(note)}
    </Scene>
  );
}

/** Auto-Align: shapes a few pixels off the grid snapping onto it (the whole tab, no selection). */
export function AutoAlignGrid() {
  return (
    <Scene w={420} h={220}>
      {/* Faint reference grid lines */}
      {[80, 160, 240, 320].map((gx) => (
        <line
          key={`v${gx}`}
          x1={gx}
          y1={28}
          x2={gx}
          y2={192}
          className="stroke-slate-200"
          strokeWidth={1}
        />
      ))}
      {[64, 128, 192].map((gy) => (
        <line
          key={`h${gy}`}
          x1={48}
          y1={gy}
          x2={372}
          y2={gy}
          className="stroke-slate-200"
          strokeWidth={1}
        />
      ))}
      {/* Where each shape sat, a few pixels off: the snap moves it only that far. */}
      <Shape x={85} y={69} w={80} h={42} dashed fill="fill-slate-50" stroke="stroke-slate-300" />
      <Shape x={236} y={124} w={80} h={42} dashed fill="fill-slate-50" stroke="stroke-slate-300" />
      {/* Snapped: corners on the grid, sides on grid lines. */}
      <Shape x={80} y={64} w={80} h={42} accent label="A" />
      <Shape x={240} y={128} w={80} h={42} accent label="B" />
    </Scene>
  );
}
