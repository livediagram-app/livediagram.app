// Tools-category illustrations (spec/55): AI assistance, zen mode, light/dark
// mode, Markdown import, and the two layout tidiers (Auto-Align, Auto Layout).
// Composed only from the shared primitives so the house style holds.

import { useId } from 'react';
import {
  Scene,
  Shape,
  Arrow,
  SelectionBox,
  Panel,
  Tabs,
  Tile,
  Label,
  TextBar,
  Button,
} from './primitives';

// --- AI ---------------------------------------------------------------------

/** The AI Assistant panel: Build / Ask / Review / Clean mode tabs, a prompt
 *  field, and a Send button. Reused across the AI articles. */
export function AiPanel() {
  return (
    <Scene w={400} h={240} bg="plain">
      <Panel x={70} y={28} w={260} h={184} title="ASSISTANT" accentBar>
        <Tabs
          x={84}
          y={62}
          items={['Build', 'Ask', 'Review', 'Clean']}
          active={0}
          tabW={58}
          h={24}
        />
        <Label x={84} y={100} size={8} weight={700} tone="muted">
          PROMPT
        </Label>
        <rect
          x={84}
          y={110}
          width={232}
          height={56}
          rx={8}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.5}
        />
        <TextBar x={94} y={124} w={210} />
        <TextBar x={94} y={138} w={166} tone="faint" />
        <Button x={228} y={176} w={88} label="Send" variant="primary" />
      </Panel>
    </Scene>
  );
}

/** Build mode: a prompt becomes a freshly drafted, connected flow on the
 *  canvas (before/after, prompt on the left, generated diagram on the right). */
export function AiBuild() {
  return (
    <Scene w={420} h={220}>
      {/* Prompt card */}
      <Panel x={20} y={66} w={150} h={92} title="BUILD">
        <rect
          x={34}
          y={104}
          width={122}
          height={42}
          rx={7}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.5}
        />
        <Label x={44} y={119} size={9} tone="body">
          Flow for
        </Label>
        <Label x={44} y={132} size={9} tone="body">
          onboarding
        </Label>
      </Panel>
      <Arrow from={[176, 110]} to={[224, 110]} kind="curved" tone="muted" dashed />
      {/* Generated, tidied flow */}
      <Shape x={236} y={36} w={76} h={38} kind="stadium" label="Sign up" />
      <Shape x={236} y={100} w={76} h={38} kind="rect" label="Verify" />
      <Shape x={236} y={164} w={76} h={38} kind="rect" accent label="Done" />
      <Arrow from={[274, 74]} to={[274, 100]} />
      <Arrow from={[274, 138]} to={[274, 164]} />
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
      {/* Tab bar */}
      <rect x={0} y={26} width={420} height={22} className="fill-slate-100" />
      <rect
        x={10}
        y={30}
        width={64}
        height={14}
        rx={4}
        className="fill-white stroke-slate-200"
        strokeWidth={1}
      />
      <rect x={80} y={30} width={64} height={14} rx={4} className="fill-slate-200" />
      {/* Canvas */}
      <rect x={0} y={48} width={420} height={192} fill={`url(#${grid})`} />
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
        y={208}
        width={104}
        height={24}
        rx={7}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={314} y={221} size={13} weight={700} tone="muted">
        −
      </Label>
      <Label x={352} y={221} size={10} weight={600} tone="body" anchor="middle">
        100%
      </Label>
      <Label x={388} y={221} size={13} weight={700} tone="muted">
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

/** The sun/moon UI-mode toggle living on the right edge of the tab bar, with
 *  the same editor shown light and dark side by side. */
export function LightDarkToggle() {
  return (
    <Scene w={420} h={210} bg="none">
      {/* Light editor */}
      <g>
        <rect
          x={16}
          y={24}
          width={186}
          height={162}
          rx={10}
          className="fill-white stroke-slate-200"
          strokeWidth={2}
        />
        <rect x={16} y={24} width={186} height={22} className="fill-slate-100" />
        <path
          d="M16 34 a10 10 0 0 1 10 -10 H192 a10 10 0 0 1 10 10 V46 H16 Z"
          className="fill-slate-100"
        />
        <Label x={28} y={36} size={8} weight={700} tone="muted">
          TABS
        </Label>
        {/* Sun glyph */}
        <g transform="translate(186 35)">
          <circle r={4} className="fill-amber-400" />
          <path
            d="M0 -8 v2 M0 6 v2 M-8 0 h2 M6 0 h2 M-5.7 -5.7 l1.4 1.4 M4.3 4.3 l1.4 1.4 M5.7 -5.7 l-1.4 1.4 M-4.3 4.3 l-1.4 1.4"
            className="stroke-amber-400"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </g>
        <Shape x={42} y={66} w={62} h={34} label="A" />
        <Shape x={120} y={120} w={62} h={34} accent label="B" />
        <Arrow from={[104, 83]} to={[120, 130]} kind="elbow" />
      </g>
      {/* Dark editor */}
      <g>
        <rect
          x={218}
          y={24}
          width={186}
          height={162}
          rx={10}
          className="fill-slate-800 stroke-slate-700"
          strokeWidth={2}
        />
        <rect x={218} y={24} width={186} height={22} className="fill-slate-700" />
        <path
          d="M218 34 a10 10 0 0 1 10 -10 H394 a10 10 0 0 1 10 10 V46 H218 Z"
          className="fill-slate-700"
        />
        <Label x={230} y={36} size={8} weight={700} className="fill-slate-400">
          TABS
        </Label>
        {/* Moon glyph */}
        <g transform="translate(388 35)">
          <path d="M3 -6 a7 7 0 1 0 4 11 a8 8 0 0 1 -4 -11 Z" className="fill-slate-200" />
        </g>
        <rect
          x={244}
          y={66}
          width={62}
          height={34}
          rx={7}
          className="fill-slate-700 stroke-brand-400"
          strokeWidth={2}
        />
        <Label x={275} y={84} size={12} weight={500} anchor="middle" className="fill-slate-100">
          A
        </Label>
        <rect
          x={322}
          y={120}
          width={62}
          height={34}
          rx={7}
          className="fill-brand-500 stroke-brand-400"
          strokeWidth={2}
        />
        <Label x={353} y={138} size={12} weight={500} anchor="middle" tone="onAccent">
          B
        </Label>
        <Arrow from={[306, 83]} to={[322, 130]} kind="elbow" />
      </g>
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

/** Before/after for the Cleanup category: a scattered, mis-sized jumble of
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

/** Auto Layout (Tidy Up): a tangled arrow graph relaid into clean layers,
 *  shown before/after with the Tidy Up label. */
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
      {/* Tidy Up arrow */}
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
      <Label x={210} y={134} size={9} weight={700} anchor="middle" tone="accent">
        Tidy Up
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
