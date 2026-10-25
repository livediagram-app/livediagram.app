import { Cursor, Label, SelectionBox } from '@liveworkspace/help-site/art/primitives';
import { Card, Stage } from '@liveworkspace/help-site/art/parts';

// The slide's column chart, tallest last.
const BARS = [30, 46, 38, 62];

// The Quick Style panel's colour swatches, the first one picked.
const SWATCHES = [
  'fill-slate-800',
  'fill-brand-500',
  'fill-violet-500',
  'fill-emerald-500',
  'fill-rose-500',
];

// Canvas: a slide being built on the canvas. Its title selected with the Quick Style panel beside it (font, size,
// bold and italic, colour), the snapping guide lining a callout up with the title's left edge, and the undo and
// zoom controls in their corners.
export function CanvasArt() {
  return (
    <Stage>
      {/* The slide, labelled the way the editor labels a page. */}
      <Label x={26} y={22} size={8.5} weight={600} tone="muted">
        Slide (16:9) · Slide
      </Label>
      <Card x={26} y={30} w={246} h={138} r={4}>
        <rect x={26} y={30} width={8} height={138} rx={2} className="fill-brand-500" />
        <Label x={52} y={64} size={17} weight={800} tone="strong">
          Q3 results
        </Label>
        <rect x={52} y={82} width={96} height={5} rx={2.5} className="fill-slate-300" />
        <rect x={52} y={92} width={74} height={5} rx={2.5} className="fill-slate-300" />

        {/* A callout, snapped to the title's left edge. */}
        <rect
          x={52}
          y={112}
          width={92}
          height={40}
          rx={6}
          className="fill-amber-50 stroke-amber-300"
          strokeWidth={1.2}
        />
        <rect x={52} y={112} width={5} height={40} rx={2} className="fill-amber-400" />
        <Label x={66} y={126} size={11} weight={800} className="fill-amber-700 dark:fill-amber-300">
          Up 24%
        </Label>
        <rect x={66} y={138} width={60} height={4} rx={2} className="fill-amber-200" />

        {/* The chart. */}
        <line x1={170} y1={152} x2={258} y2={152} className="stroke-slate-200" strokeWidth={1.2} />
        {BARS.map((h, i) => (
          <rect
            key={i}
            x={176 + i * 21}
            y={152 - h}
            width={15}
            height={h}
            rx={2}
            className={i === BARS.length - 1 ? 'fill-brand-500' : 'fill-brand-200'}
          />
        ))}
      </Card>

      {/* The snapping guide. */}
      <line
        x1={50}
        y1={38}
        x2={50}
        y2={162}
        className="stroke-rose-500"
        strokeWidth={1.2}
        strokeDasharray="3 3"
      />
      <SelectionBox x={47} y={50} w={110} h={27} />
      <Cursor x={150} y={70} colour="brand" />

      {/* The Quick Style panel. */}
      <Card x={288} y={30} w={98} h={118} r={10}>
        <Label x={298} y={46} size={8} weight={700} tone="muted">
          TEXT
        </Label>
        <rect
          x={298}
          y={54}
          width={78}
          height={18}
          rx={5}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1}
        />
        <Label x={305} y={63.5} size={9} weight={600} tone="body">
          Inter
        </Label>
        <path
          d="M364 61 l3 3 3 -3"
          className="fill-none stroke-slate-400"
          strokeWidth={1.3}
          strokeLinecap="round"
        />
        <rect
          x={298}
          y={78}
          width={30}
          height={18}
          rx={5}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1}
        />
        <Label x={313} y={87.5} anchor="middle" size={9} weight={600} tone="body">
          40
        </Label>
        <rect x={334} y={78} width={20} height={18} rx={5} className="fill-brand-500" />
        <Label x={344} y={87.5} anchor="middle" size={10} weight={800} tone="onAccent">
          B
        </Label>
        <rect
          x={358}
          y={78}
          width={18}
          height={18}
          rx={5}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1}
        />
        {/* Italic, drawn as its slanted I. */}
        <path
          d="M366 82.5 h5 M363 93.5 h5 M368.5 82.5 l-3 11"
          className="fill-none stroke-slate-600"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        {SWATCHES.map((c, i) => (
          <circle key={c} cx={305 + i * 16} cy={116} r={5.5} className={c} />
        ))}
        <circle cx={305} cy={116} r={8} className="fill-none stroke-brand-500" strokeWidth={1.4} />
        <rect x={298} y={130} width={78} height={6} rx={3} className="fill-slate-100" />
      </Card>

      {/* Undo and zoom. */}
      <Card x={14} y={184} w={56} h={24} r={8}>
        <path
          d="M30 192 l-4 4 4 4 M26 196 h8 a4 4 0 0 1 0 8 h-2"
          className="fill-none stroke-slate-500"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M54 192 l4 4 -4 4 M58 196 h-8 a4 4 0 0 0 0 8 h2"
          className="fill-none stroke-slate-400"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Card>
      <Card x={298} y={184} w={88} h={24} r={8}>
        <Label x={312} y={196.5} anchor="middle" size={13} weight={600} tone="body">
          −
        </Label>
        <Label x={342} y={196.5} anchor="middle" size={10} weight={700} tone="strong">
          100%
        </Label>
        <Label x={372} y={196.5} anchor="middle" size={13} weight={600} tone="body">
          +
        </Label>
      </Card>
    </Stage>
  );
}
