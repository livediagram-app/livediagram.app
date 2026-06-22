// Tips-and-tricks illustrations (spec/55): keyboard shortcuts and their toggle,
// the floating palette as a quick-add launchpad, and the presenting surfaces
// (Zen mode and the laser pointer). Format-painter and theme scenes are reused
// from canvas.tsx, not redrawn. Composed only from the shared primitives.

import { Scene, Shape, Arrow, Panel, Tabs, Tile, Label, TextBar } from './primitives';

/** A single key cap, sized to its glyph, drawn like a physical keyboard key. */
function KeyCap({ x, y, w = 24, label }: { x: number; y: number; w?: number; label: string }) {
  const h = 24;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={5}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <rect x={x + 2} y={y + h - 5} width={w - 4} height={3} rx={1.5} className="fill-slate-200" />
      <Label x={x + w / 2} y={y + h / 2} anchor="middle" size={11} weight={700} tone="strong">
        {label}
      </Label>
    </g>
  );
}

/** The shortcuts reference: canvas-tool key caps paired with their actions. */
export function KeyboardShortcuts() {
  const rows: [string, string][] = [
    ['V', 'Select'],
    ['H', 'Hand (pan)'],
    ['K', 'Laser pointer'],
    ['E', 'Eraser'],
    ['Z', 'Zen mode'],
  ];
  return (
    <Scene w={420} h={236} bg="plain">
      <Panel x={92} y={20} w={236} h={196} title="KEYBOARD SHORTCUTS">
        {rows.map(([key, action], i) => {
          const ry = 56 + i * 31;
          return (
            <g key={key}>
              <KeyCap x={108} y={ry} label={key} />
              <Label x={148} y={ry + 12} size={10} tone="body">
                {action}
              </Label>
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}

/** The Settings dialog row that turns single-key shortcuts off, mid-toggle. */
export function ShortcutsToggle() {
  return (
    <Scene w={420} h={200} bg="plain">
      <Panel x={86} y={28} w={248} h={144} title="SETTINGS">
        <Label x={102} y={72} size={10} weight={600} tone="strong">
          Keyboard shortcuts
        </Label>
        <TextBar x={102} y={88} w={150} tone="faint" />
        {/* Toggle switch, set on */}
        <rect x={284} y={62} width={36} height={20} rx={10} className="fill-brand-500" />
        <circle cx={310} cy={72} r={7} className="fill-white" />
        <line x1={102} y1={112} x2={318} y2={112} className="stroke-slate-200" strokeWidth={1.5} />
        <Label x={102} y={132} size={10} weight={600} tone="strong">
          Minimal panel layout
        </Label>
        {/* Toggle switch, set off */}
        <rect x={284} y={122} width={36} height={20} rx={10} className="fill-slate-200" />
        <circle cx={294} cy={132} r={7} className="fill-white" />
      </Panel>
    </Scene>
  );
}

/** The floating palette: canvas-tool toggles up top, a category tab bar, and a
 *  grid of shapes ready to drop onto the canvas. */
export function CommandPalette() {
  return (
    <Scene w={420} h={224}>
      <Shape x={28} y={146} w={72} h={42} kind="rect" label="Start" />
      <Arrow from={[100, 167]} to={[150, 146]} kind="curved" tone="muted" dashed />
      <Panel x={222} y={16} w={178} h={190} title="PALETTE">
        {/* Tool toggles */}
        <Tile x={234} y={52} active>
          <path d="M-6 -7 L-6 7 L-1 2 L3 8 L6 6 L2 1 L8 1 Z" className="fill-white" />
        </Tile>
        <Tile x={266} y={52}>
          <path
            d="M-4 4 v-6 a2 2 0 0 1 4 0 v4 m0 -2 a2 2 0 0 1 4 0 v3 a6 6 0 0 1 -6 6 a6 6 0 0 1 -5 -3"
            className="stroke-brand-500"
            strokeWidth={1.6}
            fill="none"
          />
        </Tile>
        <Tile x={298} y={52}>
          <circle r={3} className="fill-brand-500" />
        </Tile>
        <Tile x={330} y={52}>
          <rect
            x={-7}
            y={-3}
            width={14}
            height={6}
            rx={1.5}
            className="fill-brand-300 stroke-brand-500"
            strokeWidth={1.5}
          />
        </Tile>
        <Tile x={362} y={52}>
          <rect x={-7} y={-6} width={13} height={9} rx={1.5} className="fill-brand-500" />
          <path d="M-6 5 l8 -3" className="stroke-slate-500" strokeWidth={1.5} />
        </Tile>
        {/* Category tabs */}
        <Tabs x={234} y={90} items={['Shapes', 'Tools', 'Icons']} active={0} tabW={52} h={20} />
        {/* Shape results grid */}
        <Tile x={234} y={118} size={30}>
          <rect
            x={-8}
            y={-8}
            width={16}
            height={16}
            rx={2}
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={272} y={118} size={30}>
          <circle r={8} className="stroke-brand-500" strokeWidth={2} fill="none" />
        </Tile>
        <Tile x={310} y={118} size={30}>
          <path
            d="M0 -9 L9 0 L0 9 L-9 0 Z"
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={348} y={118} size={30}>
          <path
            d="M-9 -6 a9 6 0 0 1 18 0 v12 a9 6 0 0 1 -18 0 Z"
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={234} y={158} size={30}>
          <path
            d="M-6 -8 h12 v16 h-12 Z"
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={272} y={158} size={30}>
          <path
            d="M-9 0 L-4 -8 H4 L9 0 L4 8 H-4 Z"
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={310} y={158} size={30}>
          <rect
            x={-9}
            y={-5}
            width={18}
            height={10}
            rx={5}
            className="stroke-brand-500"
            strokeWidth={2}
            fill="none"
          />
        </Tile>
        <Tile x={348} y={158} size={30}>
          <path d="M-8 8 L0 -8 L8 8 Z" className="stroke-brand-500" strokeWidth={2} fill="none" />
        </Tile>
      </Panel>
    </Scene>
  );
}

/** Zen mode: a clean full-screen canvas with only the diagram and the zoom
 *  controls, every other panel hidden. */
export function ZenMode() {
  return (
    <Scene w={420} h={236}>
      <Shape x={56} y={84} w={84} h={48} kind="rect" label="Plan" />
      <Shape x={184} y={44} w={84} h={48} kind="diamond" />
      <Shape x={184} y={140} w={84} h={48} kind="rect" accent label="Ship" />
      <Shape x={314} y={84} w={84} h={48} kind="circle" label="Done" />
      <Arrow from={[140, 108]} to={[184, 80]} kind="elbow" />
      <Arrow from={[226, 92]} to={[226, 140]} />
      <Arrow from={[268, 164]} to={[330, 120]} kind="curved" />
      {/* Zoom controls, bottom-right, the one chrome Zen mode keeps */}
      <Panel x={306} y={194} w={96} h={30}>
        <Label x={322} y={210} size={13} weight={700} tone="muted">
          −
        </Label>
        <Label x={354} y={210} size={10} weight={600} tone="body" anchor="middle">
          100%
        </Label>
        <Label x={388} y={210} size={13} weight={700} tone="muted">
          +
        </Label>
      </Panel>
    </Scene>
  );
}

/** The laser pointer: a fading glowing trail sweeping across the canvas in the
 *  presenter's participant colour, ending at the cursor. */
export function LaserPointer() {
  return (
    <Scene w={420} h={210}>
      <Shape x={48} y={56} w={84} h={46} kind="rect" label="Step 1" />
      <Shape x={170} y={120} w={84} h={46} kind="rect" label="Step 2" />
      <Shape x={296} y={56} w={84} h={46} kind="rect" accent label="Step 3" />
      {/* Fading laser trail: thick faint to thin bright toward the cursor */}
      <path
        d="M90 100 Q150 170 212 143 Q300 110 332 90"
        fill="none"
        className="stroke-rose-300"
        strokeWidth={9}
        strokeLinecap="round"
        opacity={0.35}
      />
      <path
        d="M250 130 Q300 110 332 90"
        fill="none"
        className="stroke-rose-500"
        strokeWidth={5}
        strokeLinecap="round"
      />
      {/* Glowing pointer dot */}
      <circle cx={336} cy={88} r={9} className="fill-rose-500/30" />
      <circle cx={336} cy={88} r={4.5} className="fill-rose-500" />
    </Scene>
  );
}
