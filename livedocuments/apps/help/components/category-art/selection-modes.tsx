import { Label } from '@liveworkspace/help-site/art/primitives';
import { Shadow, Stage } from '@liveworkspace/help-site/art/parts';
import { ToolPicker } from '@liveworkspace/help-site/art/tool-picker';

// The slide's columns, tallest last.
const BARS = [26, 40, 32, 54];

// Selection Modes: the tool picker open with Select chosen in its Edit band, and the Present band's tools at work on
// a slide: the spotlight dimming all but the chart, and the laser's fading trail across it.
export function SelectionModesArt() {
  return (
    <Stage>
      <ToolPicker x={22} y={18} current="Select" />

      {/* The slide being presented. */}
      <Shadow x={190} y={44} w={194} h={110} r={4} />
      <rect
        x={190}
        y={44}
        width={194}
        height={110}
        rx={4}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <rect x={190} y={44} width={7} height={110} rx={2} className="fill-brand-500" />
      <Label x={208} y={66} size={13} weight={800} tone="strong">
        Q3 results
      </Label>
      <rect x={208} y={80} width={70} height={4} rx={2} className="fill-slate-300" />
      <rect x={208} y={89} width={52} height={4} rx={2} className="fill-slate-300" />
      <line x1={290} y1={140} x2={372} y2={140} className="stroke-slate-200" strokeWidth={1.2} />
      {BARS.map((h, i) => (
        <rect
          key={i}
          x={296 + i * 19}
          y={140 - h}
          width={13}
          height={h}
          rx={2}
          className={i === BARS.length - 1 ? 'fill-brand-500' : 'fill-brand-200'}
        />
      ))}

      {/* The spotlight: everything dimmed but a circle round the chart. */}
      <path
        d="M190 48 a4 4 0 0 1 4 -4 h186 a4 4 0 0 1 4 4 v102 a4 4 0 0 1 -4 4 h-186 a4 4 0 0 1 -4 -4 Z M330 112 m-40 0 a40 40 0 1 0 80 0 a40 40 0 1 0 -80 0 Z"
        className="fill-slate-900/45 help-art-as-drawn"
        fillRule="evenodd"
      />
      <circle
        cx={330}
        cy={112}
        r={40}
        className="fill-none stroke-amber-300"
        strokeWidth={1.5}
        opacity={0.8}
      />

      {/* The laser's trail, fading from its tail to the bright dot. */}
      <path
        d="M214 136 C232 112 252 150 274 130 S314 104 340 132"
        className="fill-none stroke-rose-300"
        strokeWidth={5}
        strokeLinecap="round"
        opacity={0.35}
      />
      <path
        d="M252 138 C262 136 268 134 274 130 S314 104 340 132"
        className="fill-none stroke-rose-400"
        strokeWidth={3.5}
        strokeLinecap="round"
        opacity={0.7}
      />
      <circle cx={340} cy={132} r={9} className="fill-rose-400" opacity={0.3} />
      <circle cx={340} cy={132} r={4.5} className="fill-rose-500" />
    </Stage>
  );
}
