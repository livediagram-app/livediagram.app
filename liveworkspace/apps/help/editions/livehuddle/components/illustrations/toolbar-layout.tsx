// Scenes for the Toolbar Layout article (docs/specs/007-editor/toolbar-layout.md): the editor's top row, with the
// palette strip across the top of the canvas, and a category's flyout opening under it. The chrome itself is drawn
// once in ./editor-chrome.
import { Label, Scene } from '@liveworkspace/help-site/art/primitives';
import {
  CARD_H,
  Card,
  CornerCluster,
  Icon,
  ICONS,
  STRIP_W,
  TopRow,
  stripSlot,
  topRowStripX,
} from './editor-chrome';

const W = 520;

/** A callout under the top row: a dotted leader from the cards' foot down to its words. */
function Callout({ x, y, text, strong }: { x: number; y: number; text: string; strong?: boolean }) {
  return (
    <g>
      <line
        x1={x}
        y1={8 + CARD_H + 5}
        x2={x}
        y2={y - 9}
        className="stroke-slate-300"
        strokeWidth={0.75}
        strokeDasharray="2 2"
      />
      <circle cx={x} cy={8 + CARD_H + 5} r={1.5} className="fill-slate-400" />
      <Label x={x} y={y} size={9.5} weight={600} anchor="middle" tone={strong ? 'accent' : 'body'}>
        {text}
      </Label>
    </g>
  );
}

/** The editor's top row and its corners: the logo and menu cards, the strip (Edit | Walk, the categories, Search),
 *  the corner card, and Undo | Redo, Theme & Canvas and zoom down at the bottom right. */
export function ToolbarLayoutOverview() {
  const sx = topRowStripX(W);
  return (
    <Scene w={W} h={196}>
      <TopRow w={W} />
      <Callout x={48} y={64} text="Logo" />
      <Callout x={110} y={84} text="Menu" />
      <Callout x={sx + 49} y={64} text="Edit | Walk" />
      <Callout x={stripSlot(sx, 'perks')} y={84} text="Categories" strong />
      <Callout x={stripSlot(sx, 'search')} y={64} text="Search" />
      <Callout x={W - 35} y={84} text="Share, Sign In" />
      <CornerCluster x={W - 8 - 162} y={160} />
      <Label x={W - 8 - 168} y={173} size={9.5} weight={600} anchor="end" tone="body">
        Undo, Redo, Theme & Canvas, zoom
      </Label>
    </Scene>
  );
}

// Seats' flyout as the editor lists it: each piece a glyph, a name and a line.
const SEATS: readonly [string, string, string][] = [
  [
    'Chair',
    'A chair for Avatars to sit in',
    'M5 9V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 11a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3ZM5 16v3M19 16v3',
  ],
  ['Desk', 'A desk with a computer', 'M4 11h16M6 11v8M18 11v8M9 4h6v5H9zM12 9v2'],
  [
    'Sofa',
    'A two-seater sofa',
    'M4 10V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2M2 12h20v5H2zM5 17v2M19 17v2',
  ],
  ['Meeting Table', 'A table with six seats', 'M3 12h18M7 8v8M17 8v8M10 6h4M10 18h4'],
  ['Long Table', 'A boardroom table for sixteen', 'M3 10h18v4H3zM6 7h12M6 17h12'],
  ['Bean Bag', 'A slouchy seat for one', 'M4 16c0-5 3-9 8-9s8 4 8 9H4ZM9 13h6'],
];

/** A category open: Seats pressed on the strip, its flyout hanging under it with the category's head, its pieces in
 *  two columns, and the hint at its foot. */
export function ToolbarCategoryFlyout() {
  const fx = topRowStripX(W);
  const fy = 8 + CARD_H + 6;
  const fw = STRIP_W;
  return (
    <Scene w={W} h={256}>
      <TopRow w={W} open="seats" />
      <Card x={fx} y={fy} w={fw} h={204} r={7}>
        <rect x={fx + 8} y={fy + 8} width={20} height={20} rx={5} className="fill-brand-100" />
        <Icon prims={ICONS.seats} x={fx + 18} y={fy + 18} size={10} className="stroke-brand-700" />
        <Label x={fx + 34} y={fy + 14} size={10} weight={650} tone="strong">
          Seats
        </Label>
        <Label x={fx + 34} y={fy + 25} size={9} tone="muted">
          Somewhere to sit, alone or together.
        </Label>
        <rect
          x={fx + fw - 22}
          y={fy + 11}
          width={13}
          height={11}
          rx={5.5}
          className="fill-slate-100"
        />
        <Label x={fx + fw - 15.5} y={fy + 17} size={7.5} weight={600} anchor="middle" tone="body">
          9
        </Label>
        <line
          x1={fx}
          y1={fy + 36}
          x2={fx + fw}
          y2={fy + 36}
          className="stroke-slate-100"
          strokeWidth={0.75}
        />
        {SEATS.map(([name, line, d], i) => {
          const rx = fx + 10 + (i % 2) * 154;
          const ry = fy + 46 + Math.floor(i / 2) * 40;
          return (
            <g key={name}>
              <rect
                x={rx}
                y={ry}
                width={20}
                height={20}
                rx={5}
                className="fill-white stroke-slate-200"
                strokeWidth={0.75}
              />
              <Icon prims={[{ t: 'path', d }]} x={rx + 10} y={ry + 10} size={10} />
              <Label x={rx + 27} y={ry + 6} size={9.5} weight={600} tone="strong">
                {name}
              </Label>
              <Label x={rx + 27} y={ry + 17} size={9} tone="muted">
                {line}
              </Label>
            </g>
          );
        })}
        <rect
          x={fx + 0.5}
          y={fy + 172}
          width={fw - 1}
          height={31.5}
          rx={6}
          className="fill-slate-50"
        />
        <line
          x1={fx}
          y1={fy + 172}
          x2={fx + fw}
          y2={fy + 172}
          className="stroke-slate-100"
          strokeWidth={0.75}
        />
        <Label x={fx + 10} y={fy + 188} size={9} tone="muted">
          Click to add one, or drag it onto the canvas.
        </Label>
      </Card>
    </Scene>
  );
}
