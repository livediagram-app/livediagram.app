// Palette illustrations (spec/55): the category picker, freehand drawing with
// the Pencil, shape recognition, images and the image picker, sticky notes,
// and tables. Composed only from the shared primitives so the house style
// holds. (Data / chart tiles are handled in a sibling file.)

import {
  Scene,
  Shape,
  Arrow,
  SelectionBox,
  Cursor,
  Panel,
  Dialog,
  Tabs,
  Label,
  TextBar,
} from './primitives';

// The category picker's four bands and the categories in each, in the order
// PALETTE_CATEGORIES declares them. The picker replaced the two-tab palette
// this file used to draw: there is no Tools tab any more, and a figure showing
// one under an article that opens "There is no longer a Tools tab" was the
// single most misleading picture in the help centre.
const CATEGORY_BANDS: [string, string[]][] = [
  ['COMMON', ['Shapes', 'Write', 'Draw']],
  ['STRUCTURE', ['Build', 'Components', 'Devices']],
  ['DECORATE', ['Icons', 'Stickers', 'Tech', 'Media']],
  ['DYNAMIC', ['Data', 'Behaviour', 'Collaborate']],
];

/** One category chip: the picker's tile, reduced to its label. The real tile
 *  carries an icon above the label, but thirteen invented glyphs would say
 *  less about the picker than its shape does. */
function CategoryChip({
  x,
  y,
  label,
  active = false,
}: {
  x: number;
  y: number;
  label: string;
  active?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={64}
        height={22}
        rx={6}
        className={active ? 'fill-brand-500 stroke-brand-600' : 'fill-slate-50 stroke-slate-200'}
        strokeWidth={1.4}
      />
      <Label
        x={x + 32}
        y={y + 12}
        anchor="middle"
        size={9}
        weight={600}
        tone={active ? 'onAccent' : 'body'}
      >
        {label}
      </Label>
    </g>
  );
}

/** The palette's category picker: Favourites across the top, then the four
 *  bands the thirteen categories fall into. */
export function CategoryPicker() {
  const px = 48;
  let y = 78;
  const rows: React.ReactNode[] = [];
  for (const [band, categories] of CATEGORY_BANDS) {
    rows.push(
      <Label key={band} x={px} y={y} size={8} weight={700} tone="muted">
        {band}
      </Label>,
    );
    categories.forEach((label, i) => {
      rows.push(
        <CategoryChip
          key={label}
          x={px + (i % 3) * 70}
          y={y + 10 + Math.floor(i / 3) * 28}
          label={label}
          active={label === 'Build'}
        />,
      );
    });
    y += 10 + Math.ceil(categories.length / 3) * 28 + 12;
  }
  return (
    <Scene w={300} h={330} bg="plain">
      <Panel x={36} y={20} w={228} h={294} title="PALETTE">
        <rect
          x={px}
          y={50}
          width={204}
          height={20}
          rx={6}
          className="fill-brand-50 stroke-brand-200"
          strokeWidth={1.4}
        />
        <Label x={px + 102} y={61} anchor="middle" size={9} weight={600} tone="accent">
          ★ Favourites
        </Label>
        {rows}
      </Panel>
    </Scene>
  );
}

/** A freehand pencil stroke mid-draw: a smooth hand-drawn curve on the canvas
 *  with the "Drag to draw" mode banner and a pencil cursor. */
export function PencilStroke() {
  return (
    <Scene w={420} h={220}>
      {/* Mode banner */}
      <Panel x={120} y={20} w={180} h={30}>
        <circle cx={138} cy={35} r={6} className="fill-brand-500" />
        <Label x={152} y={36} size={11} weight={600} tone="body">
          Drag to draw
        </Label>
        <Label x={262} y={36} size={11} weight={600} tone="muted">
          Cancel
        </Label>
      </Panel>
      {/* A committed, smoothed freehand stroke */}
      <path
        d="M70 150 C92 96 120 92 140 132 C158 168 188 170 208 124 C228 80 264 86 286 138 C300 172 332 168 350 120"
        fill="none"
        className="stroke-brand-500"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Pencil cursor at the leading end */}
      <g transform="translate(350 120)">
        <path
          d="M0 0 L14 14 l4 -4 L4 -4 Z"
          className="fill-white stroke-slate-500"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <path
          d="M4 -4 l4 -4 l6 6 l-4 4 Z"
          className="fill-amber-300 stroke-slate-500"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </g>
    </Scene>
  );
}

/** Before / after of shape recognition: a wobbly hand-drawn square snapping into
 *  a clean square (with the magic-wand toggle on in the banner). */
export function ShapeRecognition() {
  return (
    <Scene w={420} h={230}>
      {/* Banner with the magic-wand toggle on */}
      <Panel x={110} y={18} w={200} h={30}>
        <g transform="translate(128 33)">
          <path
            d="M-6 6 L4 -4 M3 -5 l2 2 M-7 -5 l1 -1 M6 4 l1 1"
            className="stroke-brand-500"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </g>
        <Label x={142} y={34} size={11} weight={600} tone="accent">
          Recognise shapes
        </Label>
        <rect x={278} y={26} width={22} height={14} rx={7} className="fill-brand-500" />
        <circle cx={293} cy={33} r={5} className="fill-white" />
      </Panel>
      {/* Before: rough sketch */}
      <path
        d="M60 88 L150 82 L154 168 L66 172 L60 92"
        fill="none"
        className="stroke-slate-400"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Label x={106} y={196} anchor="middle" size={11} tone="muted">
        rough sketch
      </Label>
      {/* Arrow between */}
      <Arrow from={[176, 128]} to={[244, 128]} tone="accent" />
      {/* After: clean recognised shape */}
      <Shape x={258} y={86} w={96} h={84} kind="rect" accent />
      <Label x={306} y={196} anchor="middle" size={11} tone="accent">
        clean square
      </Label>
    </Scene>
  );
}

/** An image element placed on the canvas: a framed picture with a sky / hill
 *  motif, selected. */
export function ImageElement() {
  return (
    <Scene w={420} h={220}>
      <g>
        <rect
          x={120}
          y={44}
          width={180}
          height={132}
          rx={8}
          className="fill-slate-100 stroke-brand-300"
          strokeWidth={2}
        />
        {/* picture content clipped feel */}
        <rect x={120} y={44} width={180} height={88} className="fill-brand-100" />
        <circle cx={260} cy={78} r={14} className="fill-amber-300" />
        <path d="M120 132 L172 88 L210 120 L246 96 L300 132 Z" className="fill-emerald-300" />
        <rect x={120} y={132} width={180} height={44} className="fill-slate-200" />
      </g>
      <SelectionBox x={120} y={44} w={180} h={132} />
      <Cursor x={250} y={150} colour="brand" />
    </Scene>
  );
}

/** The image picker dialog open on its Gallery tab: a grid of reusable
 *  thumbnails plus an upload drop-zone. */
export function ImagePicker() {
  return (
    <Scene w={420} h={246} bg="plain">
      <Dialog
        x={70}
        y={20}
        w={280}
        h={206}
        title="Add image"
        sceneW={420}
        sceneH={246}
        scrim={false}
      >
        <Tabs x={86} y={66} items={['Upload', 'Gallery']} active={1} tabW={84} h={22} />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const sx = 90 + col * 84;
          const sy = 98 + row * 62;
          const hues = [
            'fill-brand-200',
            'fill-emerald-200',
            'fill-amber-200',
            'fill-rose-200',
            'fill-violet-200',
            'fill-teal-200',
          ];
          return (
            <g key={i}>
              <rect
                x={sx}
                y={sy}
                width={72}
                height={50}
                rx={6}
                className="fill-slate-100 stroke-slate-200"
                strokeWidth={1.5}
              />
              <rect x={sx} y={sy} width={72} height={32} rx={6} className={hues[i]} />
              <circle cx={sx + 18} cy={sy + 16} r={6} className="fill-white/70" />
            </g>
          );
        })}
      </Dialog>
    </Scene>
  );
}

/** A small wall of coloured sticky notes with text, the way a brainstorm looks. */
export function StickyNotes() {
  const notes: [number, number, string, string, string][] = [
    [48, 50, 'fill-amber-100', 'stroke-amber-300', 'fill-amber-300'],
    [186, 38, 'fill-emerald-100', 'stroke-emerald-300', 'fill-emerald-300'],
    [300, 70, 'fill-rose-100', 'stroke-rose-300', 'fill-rose-300'],
    [120, 132, 'fill-violet-100', 'stroke-violet-300', 'fill-violet-300'],
    [256, 140, 'fill-brand-100', 'stroke-brand-300', 'fill-brand-300'],
  ];
  return (
    <Scene w={420} h={220}>
      {notes.map(([x, y, fill, stroke, bar], i) => (
        <g key={i}>
          <rect
            x={x}
            y={y}
            width={84}
            height={68}
            rx={4}
            className={`${fill} ${stroke}`}
            strokeWidth={1.5}
          />
          <rect x={x} y={y} width={84} height={68} rx={4} className="fill-slate-900/5" />
          <TextBar x={x + 12} y={y + 18} w={56} />
          <TextBar x={x + 12} y={y + 32} w={44} tone="faint" />
          <rect x={x + 12} y={y + 48} width={20} height={8} rx={2} className={bar} />
        </g>
      ))}
    </Scene>
  );
}

/** A table element on the canvas: a header row plus body cells, with one cell
 *  selected and in edit mode. */
export function TableElement() {
  const x = 96;
  const y = 50;
  const cols = 3;
  const rows = 3;
  const cw = 76;
  const ch = 36;
  return (
    <Scene w={420} h={220}>
      {/* Body */}
      <rect
        x={x}
        y={y}
        width={cw * cols}
        height={ch * rows}
        rx={6}
        className="fill-white stroke-brand-300"
        strokeWidth={2}
      />
      {/* Header band: rounded top, square bottom */}
      <path
        d={`M${x} ${y + ch} V${y + 6} a6 6 0 0 1 6 -6 H${x + cw * cols - 6} a6 6 0 0 1 6 6 V${y + ch} Z`}
        className="fill-brand-100 stroke-brand-300"
        strokeWidth={2}
      />
      {/* Grid lines */}
      {Array.from({ length: cols - 1 }, (_, i) => (
        <line
          key={`v${i}`}
          x1={x + (i + 1) * cw}
          y1={y}
          x2={x + (i + 1) * cw}
          y2={y + ch * rows}
          className="stroke-brand-200"
          strokeWidth={1.5}
        />
      ))}
      {Array.from({ length: rows - 1 }, (_, i) => (
        <line
          key={`h${i}`}
          x1={x}
          y1={y + (i + 1) * ch}
          x2={x + cw * cols}
          y2={y + (i + 1) * ch}
          className="stroke-brand-200"
          strokeWidth={1.5}
        />
      ))}
      {/* Header labels */}
      {[0, 1, 2].map((c) => (
        <rect
          key={c}
          x={x + c * cw + 14}
          y={y + ch / 2 - 3}
          width={40}
          height={7}
          rx={3}
          className="fill-brand-400"
        />
      ))}
      {/* Body text bars */}
      {[1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <TextBar
            key={`${r}-${c}`}
            x={x + c * cw + 14}
            y={y + r * ch + ch / 2 - 3}
            w={c === 2 ? 32 : 44}
          />
        )),
      )}
      {/* Selected, in-edit cell */}
      <rect
        x={x + cw}
        y={y + ch}
        width={cw}
        height={ch}
        className="fill-brand-50 stroke-brand-500"
        strokeWidth={2}
      />
      <TextBar x={x + cw + 14} y={y + ch + ch / 2 - 3} w={44} tone="accent" />
      <line
        x1={x + cw + 14}
        y1={y + ch + 10}
        x2={x + cw + 14}
        y2={y + ch + ch - 10}
        className="stroke-brand-500"
        strokeWidth={1.5}
      />
    </Scene>
  );
}

// A Page element (spec/100): the A-series sheet with its masthead (heading +
// subtitle above a hairline rule), a top-left body of prose, the wide margin,
// and the turned-back bottom-right corner that marks it as paper laid ON the
// canvas. A 120px square sits alongside at true relative scale, which is the
// point of the scene: a page is a writing surface, not another node.
export function PageSheet() {
  // Sheet geometry, kept in one place so the fold and the rule stay pinned to
  // the corner and the masthead when the sheet moves.
  const x = 96;
  const y = 20;
  const w = 148;
  const h = 200;
  const fold = 18;
  return (
    <Scene w={420} h={240}>
      {/* The sheet. A white body with a hairline border and a soft shadow, so
          it reads as paper rather than as a filled node. */}
      <rect x={x + 3} y={y + 4} width={w} height={h} rx={3} className="fill-slate-900/10" />
      <path
        d={`M${x} ${y} H${x + w} V${y + h - fold} L${x + w - fold} ${y + h} H${x} Z`}
        className="fill-white stroke-slate-300"
        strokeWidth={1.5}
      />
      {/* The turned-back corner: the cut, then a slightly darker leaf laid
          over it. Two triangles, not a curl. */}
      <path
        d={`M${x + w - fold} ${y + h} V${y + h - fold} H${x + w} Z`}
        className="fill-slate-200 stroke-slate-300"
        strokeWidth={1.5}
      />

      {/* Masthead: heading, subtitle, hairline rule. Always present, so the
          page has the same shape before and after anyone writes in it. */}
      <rect x={x + 16} y={y + 18} width={72} height={9} rx={2} className="fill-brand-500" />
      <TextBar x={x + 16} y={y + 34} w={54} tone="faint" />
      <line
        x1={x + 16}
        y1={y + 46}
        x2={x + w - 16}
        y2={y + 46}
        className="stroke-slate-200"
        strokeWidth={1.5}
      />

      {/* Body: top-left, inside a wide margin, the way a word processor sets
          prose. Never centred, which is what makes a label look like a label. */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <TextBar key={i} x={x + 16} y={y + 62 + i * 15} w={i === 3 ? 84 : i === 6 ? 62 : w - 32} />
      ))}

      {/* A 120px square beside the 420-wide sheet, drawn at the same relative
          scale (148/420 of true size), so the size gap is honest rather than
          decorative. */}
      <Shape x={286} y={99} w={42} h={42} label="Node" />
      <Label x={286} y={162} size={11} tone="muted">
        A shape, to scale
      </Label>
    </Scene>
  );
}
