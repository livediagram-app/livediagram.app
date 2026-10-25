// The second round of diagram-building elements' figures (docs/specs/009-elements/): Pointer note and Stack. Each is drawn the way the element draws on the canvas.

import { Label, Scene, Shape } from '../primitives';

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
