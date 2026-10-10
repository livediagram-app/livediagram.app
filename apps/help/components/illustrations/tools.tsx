// Tools-category illustrations (docs/specs/018-help/help-app.md): AI assistance, zen mode, light/dark
// mode, Markdown import, and the two layout tidiers (Auto-Align, Auto Layout).
// Composed only from the shared primitives so the house style holds.

import { useId } from 'react';
import {
  Scene,
  Shape,
  Arrow,
  SelectionBox,
  Panel,
  Tile,
  Label,
  TextBar,
  Button,
} from './primitives';

// --- AI ---------------------------------------------------------------------

/** The AI Assistant panel: the Ask / Clean mode buttons with the
 *  Connect agent link, the context line, the prompt box, and Send. Reused
 *  across the AI articles. */
export function AiPanel() {
  return (
    <Scene w={400} h={240} bg="canvas">
      <Shape x={18} y={60} w={70} h={38} label="Order" />
      <Shape x={18} y={140} w={70} h={38} label="Pay" />
      <Arrow from={[53, 98]} to={[53, 140]} />
      <SelectionBox x={18} y={60} w={70} h={38} />
      <Panel x={112} y={16} w={272} h={210} title="AI ASSISTANT">
        {/* Mode buttons: the active one is a solid brand pill. */}
        <rect x={124} y={46} width={46} height={24} rx={6} className="fill-brand-500" />
        <Label x={147} y={59} size={11} weight={600} anchor="middle" tone="onAccent">
          Ask
        </Label>
        <Label x={196} y={59} size={11} weight={500} anchor="middle" tone="muted">
          Clean
        </Label>
        <rect
          x={280}
          y={46}
          width={92}
          height={24}
          rx={7}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        <Label x={326} y={59} size={10} weight={600} anchor="middle">
          Connect agent
        </Label>
        <Label x={124} y={88} size={10} tone="muted">
          Context: 1 selected element
        </Label>
        <rect
          x={124}
          y={100}
          width={248}
          height={68}
          rx={8}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.5}
        />
        <Label x={134} y={116} size={11} tone="muted">
          Ask a question about the diagram…
        </Label>
        <Button x={124} y={180} w={248} h={28} label="Send" variant="primary" />
      </Panel>
    </Scene>
  );
}

// --- Zen mode ---------------------------------------------------------------

/** The editor with full chrome (header, tab bar, palette, zoom dock) over the
 *  canvas, before zen mode is turned on. */
export function ZenBefore() {
  const grid = `grid-zenbefore-${useId().replace(/:/g, '')}`;
  return (
    <Scene w={420} h={240} bg="none">
      <rect x={0} y={0} width={420} height={240} className="fill-slate-50" />
      {/* Header */}
      <rect
        x={0}
        y={0}
        width={420}
        height={26}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={14} y={14} size={11} weight={700} tone="strong">
        livediagram
      </Label>
      {/* Canvas */}
      <rect x={0} y={26} width={420} height={192} fill={`url(#${grid})`} />
      {/* Tab bar, along the bottom */}
      <rect
        x={0}
        y={218}
        width={420}
        height={22}
        className="fill-slate-100 stroke-slate-200"
        strokeWidth={1}
      />
      <rect x={10} y={222} width={64} height={14} rx={4} className="fill-brand-500" />
      <rect
        x={80}
        y={222}
        width={64}
        height={14}
        rx={4}
        className="fill-white stroke-slate-200"
        strokeWidth={1}
      />
      <defs>
        <pattern id={grid} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" className="fill-slate-200" />
        </pattern>
      </defs>
      <Shape x={96} y={108} w={80} h={44} label="A" />
      <Shape x={232} y={108} w={80} h={44} accent label="B" />
      <Arrow from={[176, 130]} to={[232, 130]} />
      {/* Palette */}
      <Panel x={356} y={64} w={50} h={110} title="">
        <Tile x={368} y={74} active size={22}>
          <rect
            x={-6}
            y={-6}
            width={12}
            height={12}
            rx={2}
            className="stroke-white"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={368} y={104} size={22}>
          <circle r={6} className="stroke-brand-500" strokeWidth={2} fill="none" />
        </Tile>
        <Tile x={368} y={134} size={22}>
          <path
            d="M0 -7 L7 0 L0 7 L-7 0 Z"
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
      </Panel>
      {/* Zoom dock */}
      <rect
        x={300}
        y={186}
        width={104}
        height={24}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={314} y={199} size={13} weight={700} tone="muted">
        −
      </Label>
      <Label x={352} y={199} size={10} weight={600} tone="body" anchor="middle">
        100%
      </Label>
      <Label x={388} y={199} size={13} weight={700} tone="muted">
        +
      </Label>
    </Scene>
  );
}

/** Zen mode on: every panel hidden, just the canvas and the lone zoom dock
 *  (now an exit control). */
export function ZenAfter() {
  return (
    <Scene w={420} h={240}>
      <Shape x={96} y={96} w={80} h={44} label="A" />
      <Shape x={232} y={96} w={80} h={44} accent label="B" />
      <Arrow from={[176, 118]} to={[232, 118]} />
      {/* Lone zoom dock with the exit-zen control */}
      <rect
        x={282}
        y={204}
        width={122}
        height={26}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={296} y={218} size={14} weight={700} tone="muted">
        −
      </Label>
      <Label x={330} y={218} size={10} weight={600} tone="body" anchor="middle">
        100%
      </Label>
      <Label x={362} y={218} size={14} weight={700} tone="muted">
        +
      </Label>
      {/* Compress / exit-zen glyph */}
      <g transform="translate(388 217)">
        <path
          d="M-5 -2 h3 v-3 M2 -5 v3 h3 M5 2 h-3 v3 M-2 5 v-3 h-3"
          className="stroke-brand-500"
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </Scene>
  );
}

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
      <ChromeButton x={338} y={159} w={70} label="Light" glyph="sun" on />
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

// --- Markdown import --------------------------------------------------------

/** A Markdown outline on the left turning into a themed left-to-right tree on
 *  the right. */
export function MarkdownToTree() {
  const lines: [number, number][] = [
    [0, 92],
    [12, 70],
    [12, 58],
    [12, 78],
    [24, 56],
    [24, 64],
  ];
  return (
    <Scene w={420} h={220}>
      {/* Markdown source card */}
      <Panel x={20} y={36} w={150} h={148} title="OUTLINE.MD">
        {lines.map(([indent, w], i) => (
          <g key={i}>
            <Label
              x={32 + indent}
              y={72 + i * 18}
              size={10}
              weight={i === 0 ? 700 : 400}
              tone={i === 0 ? 'strong' : 'muted'}
            >
              {i === 0 ? '#' : '-'}
            </Label>
            <TextBar x={44 + indent} y={68 + i * 18} w={w} tone={i === 0 ? 'muted' : 'faint'} />
          </g>
        ))}
      </Panel>
      <Arrow from={[176, 110]} to={[214, 110]} kind="curved" tone="muted" dashed />
      {/* Themed tree, left-to-right */}
      <Shape x={224} y={92} w={56} h={34} accent label="Root" />
      <Shape
        x={310}
        y={36}
        w={56}
        h={30}
        fill="fill-brand-100"
        stroke="stroke-brand-400"
        label="A"
      />
      <Shape
        x={310}
        y={94}
        w={56}
        h={30}
        fill="fill-brand-100"
        stroke="stroke-brand-400"
        label="B"
      />
      <Shape
        x={310}
        y={152}
        w={56}
        h={30}
        fill="fill-brand-100"
        stroke="stroke-brand-400"
        label="C"
      />
      <Arrow from={[280, 102]} to={[310, 51]} kind="curved" />
      <Arrow from={[280, 109]} to={[310, 109]} kind="curved" />
      <Arrow from={[280, 116]} to={[310, 167]} kind="curved" />
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
      <Shape x={24} y={40} w={64} h={30} />
      <Shape x={92} y={94} w={48} h={48} />
      <Shape x={36} y={150} w={72} h={26} />
      <Shape x={118} y={48} w={40} h={40} kind="circle" />
      <Arrow from={[88, 55]} to={[118, 68]} tone="muted" />
      <Arrow from={[116, 118]} to={[72, 150]} tone="muted" kind="elbow" />
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
      <Shape x={340} y={48} w={64} h={36} kind="circle" label="C" />
      <Shape x={340} y={110} w={64} h={36} accent label="D" />
      <Arrow from={[316, 66]} to={[340, 66]} />
      <Arrow from={[316, 128]} to={[340, 128]} />
      <Arrow from={[284, 84]} to={[284, 110]} />
    </Scene>
  );
}

/** Auto-Align: selected shapes a few pixels off the grid snapping onto it. */
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
      {/* Off-grid ghosts */}
      <Shape x={87} y={44} w={60} h={34} dashed fill="fill-slate-50" stroke="stroke-slate-300" />
      <Shape x={233} y={70} w={60} h={34} dashed fill="fill-slate-50" stroke="stroke-slate-300" />
      <Arrow from={[120, 84]} to={[120, 90]} tone="muted" head />
      <Arrow from={[262, 110]} to={[262, 116]} tone="muted" head />
      {/* Snapped, selected */}
      <Shape x={80} y={96} w={60} h={34} accent label="A" />
      <Shape x={240} y={128} w={60} h={34} accent label="B" />
      <SelectionBox x={80} y={96} w={60} h={34} />
      <SelectionBox x={240} y={128} w={60} h={34} />
    </Scene>
  );
}

/** Auto Layout: a tangled arrow graph relaid into clean layers, shown
 *  before/after with the menu row's label. */
export function AutoLayoutTidy() {
  return (
    <Scene w={420} h={230}>
      {/* Tangled, left */}
      <Shape x={28} y={40} w={50} h={28} label="1" />
      <Shape x={118} y={90} w={50} h={28} label="2" />
      <Shape x={36} y={150} w={50} h={28} label="3" />
      <Shape x={132} y={32} w={50} h={28} label="4" />
      <Arrow from={[78, 54]} to={[118, 100]} tone="muted" />
      <Arrow from={[118, 110]} to={[78, 156]} tone="muted" />
      <Arrow from={[168, 96]} to={[152, 60]} tone="muted" />
      <Arrow from={[157, 60]} to={[78, 50]} tone="muted" />
      {/* Auto Layout arrow */}
      <g transform="translate(196 108)">
        <rect
          x={0}
          y={-12}
          width={28}
          height={24}
          rx={7}
          className="fill-brand-500 stroke-brand-600"
          strokeWidth={1.5}
        />
        <path
          d="M8 0 h12 M15 -5 l5 5 l-5 5"
          className="stroke-white"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <Label x={210} y={134} size={10} weight={700} anchor="middle" tone="accent">
        Auto Layout
      </Label>
      {/* Laid out in layers, right */}
      <Shape x={244} y={40} w={52} h={30} label="1" />
      <Shape x={330} y={40} w={52} h={30} label="4" />
      <Shape x={244} y={108} w={52} h={30} accent label="2" />
      <Shape x={244} y={176} w={52} h={30} label="3" />
      <Arrow from={[296, 55]} to={[330, 55]} />
      <Arrow from={[270, 70]} to={[270, 108]} />
      <Arrow from={[270, 138]} to={[270, 176]} />
    </Scene>
  );
}

// --- Markdown import (dialog) ----------------------------------------------

/** The Import to tab dialog on its Markdown step: the replace warning, the
 *  All formats back bar with the chosen format, the paste box, and the two
 *  ways to import. */
export function MarkdownImportPanel() {
  const lines = ['# Project', '- Research', '  - Interviews', '- Build', '- Launch'];
  return (
    <Scene w={420} h={240} bg="none">
      <rect
        x={20}
        y={8}
        width={380}
        height={224}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <Label x={36} y={28} size={13} weight={700} tone="strong">
        Import to tab
      </Label>
      <Label x={36} y={44} size={10} tone="muted">
        Paste your Markdown, or import a file.
      </Label>
      {/* Replace warning */}
      <rect
        x={36}
        y={56}
        width={348}
        height={24}
        rx={6}
        className="fill-amber-400/15 stroke-amber-400"
        strokeWidth={1}
      />
      <Label x={48} y={69} size={10} className="fill-slate-700">
        This replaces everything on Tab 1 with the imported content.
      </Label>
      {/* Back bar with the chosen format as its chip */}
      <Label x={36} y={98} size={10} weight={600} tone="body">
        ‹ All formats
      </Label>
      <rect x={112} y={89} width={66} height={18} rx={9} className="fill-brand-50" />
      <Label x={145} y={99} size={10} weight={600} tone="accent" anchor="middle">
        Markdown
      </Label>
      {/* Paste box */}
      <rect
        x={36}
        y={114}
        width={348}
        height={78}
        rx={8}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      {lines.map((l, i) => (
        <Label key={l} x={48} y={126 + i * 14} size={10} tone={i === 0 ? 'strong' : 'body'}>
          {l.replace(/^ +/, (m) => ' '.repeat(m.length * 2))}
        </Label>
      ))}
      <Button x={168} y={200} w={138} h={24} label="Import a file instead" variant="ghost" />
      <Button x={312} y={200} w={72} h={24} label="Import" variant="primary" />
    </Scene>
  );
}
