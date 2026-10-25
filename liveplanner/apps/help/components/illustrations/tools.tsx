// Tools-category illustrations (docs/specs/018-help/help-app.md): AI assistance, zen mode, light/dark
// mode, and the two layout tidiers (Auto-Align, Auto Layout).
// Composed only from the shared primitives so the house style holds.

import { Scene, Shape, Arrow, Label } from '@liveworkspace/help-site/art/primitives';

// --- AI ---------------------------------------------------------------------

// --- Zen mode ---------------------------------------------------------------

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

/** Before/after for the layout tidiers: a scattered, mis-sized jumble of
 *  shapes tidied into a neat layout. */
export function CleanupBeforeAfter() {
  return (
    <Scene w={420} h={220}>
      {/* Messy, left */}
      {/* The same four shapes and three arrows as the right, off-grid and mis-sized. */}
      <Shape x={24} y={44} w={60} h={30} label="A" />
      <Shape x={124} y={30} w={50} h={44} kind="circle" label="C" />
      <Shape x={38} y={118} w={46} h={40} label="B" />
      <Shape x={116} y={134} w={70} h={26} accent label="D" />
      <Arrow from={[84, 57]} to={[124, 54]} tone="muted" />
      <Arrow from={[58, 74]} to={[60, 118]} tone="muted" />
      <Arrow from={[84, 142]} to={[116, 146]} tone="muted" />
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
      {/* Tidied, right */}
      <Shape x={252} y={48} w={64} h={36} label="A" />
      <Shape x={252} y={110} w={64} h={36} label="B" />
      <Shape x={352} y={46} w={40} h={40} kind="circle" label="C" />
      <Shape x={340} y={110} w={64} h={36} accent label="D" />
      <Arrow from={[316, 66]} to={[352, 66]} />
      <Arrow from={[316, 128]} to={[340, 128]} />
      <Arrow from={[284, 84]} to={[284, 110]} />
    </Scene>
  );
}
