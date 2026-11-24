// The Magnifier card's art (docs/specs/008-canvas/magnifier.md): a lens on the cursor that shows the part of a dense
// diagram under it enlarged, while the whole tab stays at its own zoom. On the 300 by 96 stage of ./canvas-parts.
import { Scene, YOU, from } from './canvas-parts';

const INK = 'fill-(--art-ink-fill) stroke-(--art-ink-stroke)';
const INK_TEXT = 'fill-(--art-ink-text)';

/** A tiny box of the zoomed-out diagram, its label too small to read. */
function Tiny({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <rect className={INK} x={x} y={y} width="26" height="11" rx="2" strokeWidth="0.8" />
      <text
        className={INK_TEXT}
        x={x + 13}
        y={y + 7}
        fontSize="3.4"
        fontWeight="600"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}

const ROWS: [number, number, string][] = [
  [20, 16, 'Gateway'],
  [60, 16, 'Auth'],
  [100, 16, 'Users'],
  [20, 42, 'Cart'],
  [60, 42, 'Orders'],
  [100, 42, 'Stock'],
  [20, 68, 'Email'],
  [60, 68, 'Billing'],
  [100, 68, 'Ledger'],
  [200, 16, 'Search'],
  [240, 16, 'Index'],
  [200, 68, 'Reports'],
  [240, 68, 'Archive'],
];

/** Magnifier: a busy diagram at a glance, and a lens that glides over it to read the Orders box up close. */
export function MagnifierArt() {
  return (
    <Scene>
      <g className="stroke-(--art-arrow)" strokeWidth="0.7" fill="none">
        <path d="M46 21.5 H60 M86 21.5 H100 M46 47.5 H60 M86 47.5 H100 M73 27 V42 M73 53 V68 M86 73.5 H100" />
        <path d="M226 21.5 H240 M226 73.5 H240 M213 27 V68" />
      </g>
      {ROWS.map(([x, y, label]) => (
        <Tiny key={label} x={x} y={y} label={label} />
      ))}

      {/* The lens arrives over Orders and holds there: the box drawn larger, inside the circle. */}
      <g className="fa-a-move" style={from(110, -6, 0.2)}>
        <circle className="fill-(--art-paper)" cx="73" cy="47.5" r="27" />
        <g className="stroke-(--art-arrow)" strokeWidth="1.6" fill="none">
          <path d="M46.5 47.5 H52 M94 47.5 H99.5" />
        </g>
        <rect className={INK} x="52" y="38" width="42" height="19" rx="4" strokeWidth="1.6" />
        <text
          className={INK_TEXT}
          x="73"
          y="50.2"
          fontSize="8"
          fontWeight="600"
          textAnchor="middle"
        >
          Orders
        </text>
        <circle
          className="fill-none stroke-slate-400 dark:stroke-slate-500"
          cx="73"
          cy="47.5"
          r="27"
          strokeWidth="1.6"
        />
        <circle cx="73" cy="47.5" r="1.6" fill={YOU} />
      </g>
    </Scene>
  );
}
