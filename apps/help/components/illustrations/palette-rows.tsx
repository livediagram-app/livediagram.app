// The palette's row-style categories (docs/specs/010-palette/palette-top-level-categories.md):
// Write, Draw, Build, Components, Media and Data render as a column of rows, each a
// glyph chip, the tile's caption, a one-line blurb and, where it has one, its key.
// The captions, blurbs and keys are copied from PALETTE_TILES
// (apps/live/components/palette/palette-tile-defs.tsx), so the picture reads the
// way the editor does. Composed from the shared primitives.

import { Scene, Panel, Label } from './primitives';

type Row = { caption: string; blurb: string; key?: string };

// One entry per row-style category, in the order the editor lists its tiles.
// Components and Media end in a collapsed group row (Web Elements, Embed).
const CATEGORY_ROWS: Record<string, Row[]> = {
  Write: [
    { caption: 'Page', blurb: 'A paper-shaped page for prose' },
    { caption: 'Text', blurb: 'A free-standing text label', key: 'T' },
    { caption: 'Note', blurb: 'A coloured note card', key: 'N' },
    { caption: 'Annotation', blurb: 'A marker that holds a note' },
  ],
  Draw: [
    { caption: 'Freehand', blurb: 'Sketch a stroke, left as drawn', key: 'P' },
    { caption: 'Shape Pen', blurb: 'A rough shape snaps to the real one', key: '6' },
    { caption: 'Highlighter', blurb: 'A wide translucent marker stroke' },
    { caption: 'Polygon', blurb: 'Straight edges, point by point' },
    { caption: 'Arrow', blurb: 'A connector you place by hand', key: 'A' },
    { caption: 'Line', blurb: 'A plain line, no pointers' },
  ],
  Build: [
    { caption: 'Mind node', blurb: 'Tab adds a child, Enter a sibling' },
    { caption: 'Table', blurb: 'An editable grid of cells' },
    { caption: 'Lane', blurb: 'A titled band that carries its steps' },
    { caption: 'Frame', blurb: 'A labelled box that groups a section', key: 'F' },
    { caption: 'Timeline', blurb: 'A track for sequencing events' },
  ],
  Components: [
    { caption: 'Code', blurb: 'Syntax-highlighted code card' },
    { caption: 'Checklist', blurb: 'Tickable to-do rows' },
    { caption: 'Web Elements', blurb: 'Themed page sections' },
  ],
  Data: [
    { caption: 'Pie', blurb: 'Proportions of a whole' },
    { caption: 'Bar', blurb: 'Compare values side by side' },
    { caption: 'Line', blurb: 'A trend over time' },
    { caption: 'Legend', blurb: 'A key for your colours' },
    { caption: 'Progress', blurb: 'How far along something is' },
    { caption: 'Donut', blurb: 'The same, as a donut meter' },
    { caption: 'Rating', blurb: 'A score out of five stars' },
  ],
  Media: [
    { caption: 'Image', blurb: 'Place an uploaded picture', key: '9' },
    { caption: 'Avatar', blurb: 'A circular photo of a person' },
  ],
};

export type PaletteCategory = keyof typeof CATEGORY_ROWS;

const ROW_H = 30;
const HEAD_H = 40;

/** The height a category's panel needs, so a scene can size itself around it. */
function paletteRowsHeight(category: PaletteCategory): number {
  return HEAD_H + CATEGORY_ROWS[category]!.length * ROW_H + 10;
}

/** The floating palette open on one row-style category: the category dropdown
 *  at the top, then its rows. `active` marks the row whose tool is armed. */
export function PaletteCategoryPanel({
  x,
  y,
  w = 236,
  category,
  active,
}: {
  x: number;
  y: number;
  w?: number;
  category: PaletteCategory;
  active?: string;
}) {
  const rows = CATEGORY_ROWS[category]!;
  return (
    <Panel x={x} y={y} w={w} h={paletteRowsHeight(category)}>
      {/* The category dropdown: the open category's name and a chevron. */}
      <rect
        x={x + 10}
        y={y + 9}
        width={w - 20}
        height={24}
        rx={7}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.4}
      />
      <Label x={x + 20} y={y + 22} size={11} weight={700} tone="strong">
        {category}
      </Label>
      <path
        d={`M${x + w - 28} ${y + 19} l4 4 l4 -4`}
        fill="none"
        className="stroke-slate-400"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {rows.map((row, i) => {
        const ry = y + HEAD_H + i * ROW_H;
        const on = row.caption === active;
        return (
          <g key={row.caption}>
            {on && (
              <rect
                x={x + 6}
                y={ry}
                width={w - 12}
                height={ROW_H - 3}
                rx={7}
                className="fill-brand-50 stroke-brand-300"
                strokeWidth={1.2}
              />
            )}
            <rect
              x={x + 12}
              y={ry + 5}
              width={18}
              height={18}
              rx={5}
              className={on ? 'fill-brand-100' : 'fill-slate-100'}
            />
            <Label x={x + 38} y={ry + 9} size={10} weight={700} tone="strong">
              {row.caption}
            </Label>
            <Label x={x + 38} y={ry + 21} size={10} tone="muted">
              {row.blurb}
            </Label>
            {row.key && (
              <g>
                <rect
                  x={x + w - 26}
                  y={ry + 6}
                  width={14}
                  height={14}
                  rx={3}
                  className="fill-white stroke-slate-300"
                  strokeWidth={1}
                />
                <Label x={x + w - 19} y={ry + 14} anchor="middle" size={10} weight={600}>
                  {row.key}
                </Label>
              </g>
            )}
          </g>
        );
      })}
    </Panel>
  );
}

/** A row-style category on its own, centred in a scene, with one row armed. */
export function PaletteRows({ category, active }: { category: PaletteCategory; active?: string }) {
  const w = 256;
  const h = paletteRowsHeight(category);
  return (
    <Scene w={420} h={h + 32} bg="plain">
      <PaletteCategoryPanel x={(420 - w) / 2} y={16} w={w} category={category} active={active} />
    </Scene>
  );
}
