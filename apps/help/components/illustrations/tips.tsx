// Tips-and-tricks illustrations (docs/specs/018-help/help-app.md): keyboard shortcuts and their toggle,
// the floating palette as a quick-add launchpad, and the presenting surfaces
// (Zen mode and the laser pointer). Format-painter and theme scenes are reused
// from canvas.tsx, not redrawn. Composed only from the shared primitives.

import { Scene, Shape, Arrow, Panel, Tile, Label, TextBar } from './primitives';

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

/** The shortcut reference in Settings › Keyboard: the All Shortcuts list,
 *  its Tools group open, each key cap beside its label as the editor words it. */
export function KeyboardShortcuts() {
  const rows: [string, string][] = [
    ['V', 'Select tool (or 1)'],
    ['H', 'Hand tool'],
    ['K', 'Laser pointer'],
    ['E', 'Eraser (click / drag to delete)'],
    ['Z', 'Zen mode (focus)'],
  ];
  return (
    <Scene w={420} h={236} bg="plain">
      <Panel x={80} y={14} w={260} h={208} title="ALL SHORTCUTS">
        <Label x={96} y={50} size={10} weight={700} tone="strong">
          Tools
        </Label>
        {rows.map(([key, action], i) => {
          const ry = 62 + i * 30;
          return (
            <g key={key}>
              <KeyCap x={96} y={ry} label={key} />
              <Label x={134} y={ry + 12} size={10} tone="body">
                {action}
              </Label>
            </g>
          );
        })}
      </Panel>
    </Scene>
  );
}

/** Settings › Keyboard: the Keyboard Shortcuts switch, turned off, above the
 *  All Shortcuts reference it gates. */
export function ShortcutsToggle() {
  return (
    <Scene w={420} h={200} bg="plain">
      <Panel x={86} y={28} w={248} h={144} title="KEYBOARD">
        <Label x={102} y={72} size={10} weight={600} tone="strong">
          Keyboard Shortcuts
        </Label>
        <TextBar x={102} y={88} w={150} tone="faint" />
        {/* Toggle switch, set off */}
        <rect x={284} y={62} width={36} height={20} rx={10} className="fill-slate-200" />
        <circle cx={294} cy={72} r={7} className="fill-white help-art-as-drawn" />
        <line x1={102} y1={112} x2={318} y2={112} className="stroke-slate-200" strokeWidth={1.5} />
        <Label x={102} y={132} size={10} weight={600} tone="strong">
          All Shortcuts
        </Label>
        <TextBar x={102} y={148} w={120} tone="faint" />
      </Panel>
    </Scene>
  );
}

/** A dropdown chip in the palette's header band: a label and a caret. */
function PaletteChip({ x, y, w, label }: { x: number; y: number; w: number; label: string }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={20}
        rx={6}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={x + 9} y={y + 11} size={10} weight={600} tone="strong">
        {label}
      </Label>
      <path
        d={`M${x + w - 14} ${y + 8} l4 4 l4 -4`}
        className="stroke-slate-400"
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

/** The floating palette: the Diagram mode chip in its title row, the
 *  selection-mode and category dropdowns, and Popular's first tiles. */
export function CommandPalette() {
  const stroke = { className: 'stroke-brand-500', strokeWidth: 2, fill: 'none' } as const;
  const glyphs = [
    <rect key="sq" x={-8} y={-8} width={16} height={16} rx={2} {...stroke} />,
    <circle key="ci" r={8} {...stroke} />,
    <path key="di" d="M0 -9 L9 0 L0 9 L-9 0 Z" {...stroke} />,
    <path key="tx" d="M-6 -7 h12 M0 -7 v14" {...stroke} strokeLinecap="round" />,
    <path key="ar" d="M-7 6 L6 -6 M1 -6 h5 v5" {...stroke} strokeLinecap="round" />,
    <rect key="fr" x={-9} y={-8} width={18} height={16} rx={2} {...stroke} strokeDasharray="3 2" />,
    <rect key="st" x={-8} y={-8} width={16} height={16} rx={1.5} className="fill-amber-400" />,
    <path key="im" d="M-9 7 L-3 -1 L1 3 L4 0 L9 7 Z" className="fill-brand-300" />,
  ];
  return (
    <Scene w={420} h={224}>
      <Shape x={28} y={146} w={72} h={42} kind="rect" label="Start" />
      <Arrow from={[100, 167]} to={[150, 146]} kind="curved" tone="muted" dashed />
      <Panel x={222} y={16} w={178} h={190} title="PALETTE">
        {/* The editor mode chip in the title row. */}
        <rect x={334} y={20} width={58} height={15} rx={7.5} className="fill-brand-50" />
        <Label x={363} y={28} anchor="middle" size={10} weight={600} tone="accent">
          Diagram
        </Label>
        <PaletteChip x={232} y={48} w={72} label="Select" />
        <PaletteChip x={312} y={48} w={78} label="Popular" />
        {glyphs.map((g, i) => (
          <Tile key={i} x={236 + (i % 4) * 40} y={84 + Math.floor(i / 4) * 44} size={30}>
            {g}
          </Tile>
        ))}
      </Panel>
    </Scene>
  );
}

/** Zen mode: a clean full-screen view with only the canvas and the zoom
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
      {/* Zoom controls, bottom-right, the one chrome Zen mode keeps, with the
          Exit zen mode button beside them. */}
      <Panel x={270} y={194} w={30} h={30}>
        <path
          d="M279 203 l4 4 M279 207 h4 v-4 M291 215 l-4 -4 M291 211 h-4 v4"
          className="stroke-brand-500"
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Panel>
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
