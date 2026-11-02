// The second round of diagram-building elements' figures (docs/specs/009-elements/): Pointer note, Stack, and Diagram key
// and tag colours. Each is drawn the way the element draws on the canvas.

import { Arrow, Label, Scene, Shape } from '@liveworkspace/help-site/art/primitives';

// --- Pointer note ------------------------------------------------------------------

/** A note with its leader out to a dot pinned on a box's corner. */
export function PointerNoteFigure() {
  return (
    <Scene w={420} h={180}>
      <Shape x={226} y={96} w={150} h={56} label="Price cache" />
      <rect
        x={30}
        y={24}
        width={172}
        height={50}
        rx={8}
        className="fill-amber-50 stroke-amber-600"
        strokeWidth={1.5}
      />
      <Label x={42} y={42} size={11} className="fill-amber-900">
        Stale for 60 s after
      </Label>
      <Label x={42} y={58} size={11} className="fill-amber-900">
        a price change
      </Label>
      <path d="M150 74 L226 96" className="stroke-amber-600" strokeWidth={1.5} fill="none" />
      <circle cx={226} cy={96} r={5} className="fill-amber-600" />
      <circle
        cx={226}
        cy={96}
        r={10}
        className="fill-none stroke-amber-600"
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      <Label x={210} y={166} anchor="middle" size={11} weight={600} tone="accent">
        The dot is pinned to the corner: move the box and the note follows
      </Label>
    </Scene>
  );
}

// --- Stack -----------------------------------------------------------------------------

/** A row stack of three cards with even gaps, and a grid stack of four. */
export function StackFigure() {
  const row = ['Auth', 'Orders', 'Payments'];
  const grid = ['Web', 'iOS', 'Mac', 'CLI'];
  return (
    <Scene w={420} h={210}>
      <rect
        x={14}
        y={26}
        width={272}
        height={78}
        rx={8}
        className="fill-none stroke-slate-400"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <Label x={24} y={38} size={10} weight={600} tone="muted">
        Services
      </Label>
      {row.map((t, i) => (
        <Shape key={t} x={26 + i * 86} y={50} w={76} h={42} label={t} />
      ))}
      <rect
        x={300}
        y={26}
        width={106}
        height={170}
        rx={8}
        className="fill-none stroke-slate-400"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      {grid.map((t, i) => (
        <Shape
          key={t}
          x={310 + (i % 2) * 48}
          y={38 + Math.floor(i / 2) * 76}
          w={40}
          h={66}
          label={t}
        />
      ))}
      <Label x={150} y={136} anchor="middle" size={11} weight={600} tone="accent">
        Drop something in: the rest
      </Label>
      <Label x={150} y={152} anchor="middle" size={11} weight={600} tone="accent">
        make room, gaps stay even
      </Label>
    </Scene>
  );
}

// --- Diagram key and tag colours ---------------------------------------------------------

/** Two cards edged by their tag's colour, and a key listing the line styles and the tags. */
export function DiagramKeyFigure() {
  const card = (x: number, y: number, title: string, tag: string, edge: string, ink: string) => (
    <g>
      <rect x={x} y={y} width={120} height={56} rx={8} className="fill-white stroke-slate-300" />
      <rect x={x} y={y} width={5} height={56} rx={2} className={edge} />
      <Label x={x + 14} y={y + 18} size={11} weight={700} tone="strong">
        {title}
      </Label>
      <rect x={x + 14} y={y + 32} width={58} height={15} rx={7.5} className="fill-slate-50" />
      <Label x={x + 43} y={y + 40} anchor="middle" size={9} weight={600} className={ink}>
        {tag}
      </Label>
    </g>
  );
  return (
    <Scene w={420} h={200}>
      {card(18, 22, 'Checkout', 'critical', 'fill-rose-500', 'fill-rose-600')}
      {card(18, 118, 'Search', 'beta', 'fill-violet-500', 'fill-violet-600')}
      <Arrow from={[80, 80]} to={[80, 114]} />
      {/* An event back the other way, dashed: the key lists both line styles. */}
      <path
        d="M138 136 H170 V42 H146"
        className="fill-none stroke-brand-400"
        strokeWidth={2}
        strokeDasharray="6 5"
      />
      <path d="M146 37.5 L139 42 L146 46.5 Z" className="fill-brand-400" />
      <rect
        x={198}
        y={30}
        width={210}
        height={146}
        rx={8}
        className="fill-white stroke-slate-300"
      />
      <Label x={210} y={48} size={11} weight={700} tone="strong">
        Key
      </Label>
      <path d="M210 74 h30" className="stroke-slate-500" strokeWidth={1.5} />
      <Label x={250} y={74} size={10}>
        Request: waits for the reply
      </Label>
      <path d="M210 102 h30" className="stroke-slate-500" strokeWidth={1.5} strokeDasharray="5 4" />
      <Label x={250} y={102} size={10}>
        Event: fire and forget
      </Label>
      <rect x={210} y={122} width={30} height={14} rx={3} className="fill-rose-500" />
      <Label x={250} y={129} size={10}>
        Critical path
      </Label>
      <rect x={210} y={148} width={30} height={14} rx={3} className="fill-violet-500" />
      <Label x={250} y={155} size={10}>
        In beta
      </Label>
    </Scene>
  );
}
