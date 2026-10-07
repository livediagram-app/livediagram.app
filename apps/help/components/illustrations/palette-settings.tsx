// Palette behaviour scenes for the Palette Settings articles (Quick-add on Hover, Reset Palette
// Position): the quick-add "+" menu opened by hovering, and the palette's own header with its Reset
// position button. The Settings dialog panes those articles also show live in settings-dialog.tsx.
// Labels are lifted from apps/live: the quick-add options from
// components/canvas/quick-connect-options.tsx, the header buttons from
// components/primitives/MovablePanelHeader.tsx.

import { Label, Scene, Shape, SelectionBox } from './primitives';

// The four default quick-add options, drawn as the strip's icon buttons (Duplicate, Arrow,
// Pencil, Text), left to right.
function OptionGlyph({ kind }: { kind: 'duplicate' | 'arrow' | 'pencil' | 'text' }) {
  const s = {
    className: 'stroke-slate-600',
    strokeWidth: 1.6,
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
  switch (kind) {
    case 'duplicate':
      return (
        <g {...s}>
          <rect x={-6} y={-3} width={9} height={9} rx={2} />
          <path d="M-3 -3 V-5 a1.5 1.5 0 0 1 1.5 -1.5 H4.5 A1.5 1.5 0 0 1 6 -5 V1.5 A1.5 1.5 0 0 1 4.5 3 H3" />
        </g>
      );
    case 'arrow':
      return <path d="M-5 5 L5 -5 M-1 -5 H5 V1" {...s} />;
    case 'pencil':
      return <path d="M-5 5 L-4 1 L3 -6 L6 -3 L-1 4 Z" {...s} />;
    case 'text':
      return <path d="M-5 -5 H5 M0 -5 V6" {...s} />;
  }
}

/** Quick-add on hover: the selected element's right-hand "+" with the pointer resting on it and
 *  its menu already open beside it, no click needed. The hover card names the option. */
export function QuickAddHoverMenu() {
  const opts = ['duplicate', 'arrow', 'pencil', 'text'] as const;
  return (
    <Scene w={420} h={210}>
      <Shape x={48} y={78} w={112} h={60} accent label="Idea" />
      <SelectionBox x={48} y={78} w={112} h={60} />
      {/* The other three "+" buttons, on the remaining edges. */}
      {(
        [
          [104, 62],
          [104, 154],
          [32, 108],
        ] as const
      ).map(([cx, cy]) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r={9} className="fill-white stroke-slate-200" strokeWidth={1.5} />
          <path
            d={`M${cx} ${cy - 4}v8M${cx - 4} ${cy}h8`}
            className="stroke-slate-500"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </g>
      ))}
      {/* The hovered "+" on the right edge. */}
      <circle
        cx={184}
        cy={108}
        r={12}
        className="fill-slate-100 stroke-slate-200"
        strokeWidth={2}
      />
      <path
        d="M184 102v12M178 108h12"
        className="stroke-slate-700"
        strokeWidth={2}
        strokeLinecap="round"
      />
      {/* Its menu: one strip of icon buttons. */}
      <rect
        x={204}
        y={92}
        width={140}
        height={32}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {opts.map((k, i) => (
        <g key={k}>
          {i === 1 && (
            <rect
              x={210 + i * 33}
              y={96}
              width={28}
              height={24}
              rx={5}
              className="fill-slate-100"
            />
          )}
          <g transform={`translate(${224 + i * 33} 108)`}>
            <OptionGlyph kind={k} />
          </g>
        </g>
      ))}
      {/* The hover card on Arrow. */}
      <rect
        x={210}
        y={132}
        width={186}
        height={42}
        rx={8}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={220} y={146} size={11} weight={700} tone="strong">
        Arrow
      </Label>
      <Label x={220} y={163} size={10} tone="body">
        Drag out an arrow from this side.
      </Label>
      {/* The pointer resting on the "+": a hover, not a click. */}
      <g transform="translate(188 111)">
        <path
          d="M0 0 L0 15 L4.2 11 L6.6 16.2 L9.2 15 L6.8 9.8 L12 9.4 Z"
          className="fill-white stroke-slate-700"
          strokeWidth={1}
        />
      </g>
    </Scene>
  );
}

/** The floating palette's header after the palette has been moved: the title, the editor mode
 *  switch, help, the Reset position button (with its hover card) and Collapse. */
export function PaletteHeaderReset() {
  const ic = { className: 'stroke-slate-500', strokeWidth: 1.6, fill: 'none' } as const;
  return (
    <Scene w={420} h={200}>
      <rect
        x={60}
        y={36}
        width={300}
        height={128}
        rx={12}
        className="fill-white stroke-slate-200"
        strokeWidth={2}
      />
      <line x1={60} y1={72} x2={360} y2={72} className="stroke-slate-200" strokeWidth={1.5} />
      <Label x={76} y={55} size={10} weight={700} tone="muted">
        PALETTE
      </Label>
      {/* The editor mode switch, labelled. */}
      <rect
        x={164}
        y={44}
        width={100}
        height={22}
        rx={6}
        className="fill-brand-50 stroke-brand-100"
        strokeWidth={1}
      />
      <Label x={190} y={56} size={10} weight={600} className="fill-brand-700">
        Diagram
      </Label>
      <rect x={172} y={50} width={11} height={11} rx={2} className="fill-none stroke-brand-600" />
      <path
        d="M250 53 l3 3 l3 -3"
        className="stroke-brand-600"
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
      />
      {/* Help */}
      <circle cx={280} cy={55} r={7} {...ic} />
      <Label x={280} y={56} size={10} anchor="middle" weight={700} tone="muted">
        ?
      </Label>
      {/* Reset position: highlighted, the subject of the scene. */}
      <rect
        x={294}
        y={45}
        width={20}
        height={20}
        rx={5}
        className="fill-brand-50 stroke-brand-300"
      />
      {/* The real glyph: a diagonal arrow tucking into a corner. */}
      <path
        d="M6.5 3H9v2.5M9 3L5 7M3 7v2h6"
        transform="translate(296.8 47.8) scale(1.2)"
        className="stroke-brand-600"
        strokeWidth={1.3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Collapse */}
      <path d="M328 52 l5 5 l5 -5" {...ic} strokeLinecap="round" />
      {/* A hint of the palette body underneath. */}
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={80 + i * 66}
          y={90}
          width={52}
          height={52}
          rx={8}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1.5}
        />
      ))}
      {/* The hover card. */}
      <rect
        x={220}
        y={72}
        width={170}
        height={44}
        rx={8}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      <Label x={230} y={87} size={11} weight={700} tone="strong">
        Reset position
      </Label>
      <Label x={230} y={104} size={10} tone="body">
        Snap back to the default corner.
      </Label>
    </Scene>
  );
}
