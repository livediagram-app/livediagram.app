// Palette illustrations (docs/specs/018-help/help-app.md): the category picker, freehand drawing with
// the Pencil, shape recognition, images and the image picker, sticky notes,
// and tables. Composed only from the shared primitives so the house style
// holds. (Data / chart tiles are handled in a sibling file.)

import { Scene, SelectionBox, Cursor, Dialog, Tabs, TextBar } from './primitives';

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

/** The image picker open on its Gallery tab (beside Upload): a
 *  grid of reusable thumbnails. */
export function ImagePicker() {
  return (
    <Scene w={420} h={246} bg="plain">
      <Dialog x={70} y={20} w={280} h={206} title="Image" sceneW={420} sceneH={246} scrim={false}>
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
  const notes: [number, number, string, string][] = [
    [48, 50, 'fill-amber-100', 'fill-amber-300'],
    [186, 38, 'fill-emerald-100', 'fill-emerald-300'],
    [300, 70, 'fill-rose-100', 'fill-rose-300'],
    [120, 132, 'fill-violet-100', 'fill-violet-300'],
    [256, 140, 'fill-brand-100', 'fill-brand-300'],
  ];
  return (
    <Scene w={420} h={220}>
      {notes.map(([x, y, fill, bar], i) => (
        <g key={i}>
          {/* Square corners and no border, as a sticky draws by default */}
          <rect x={x} y={y} width={84} height={68} className={fill} />
          <rect x={x} y={y} width={84} height={68} className="fill-slate-900/5" />
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
