// Scenes for the Toolbar Layout article (docs/specs/007-editor/toolbar-layout.md): the strip across the top
// of the canvas as the category bar, and a category's flyout opening under it. `Strip` and `MenuCard`
// are exported so other scenes draw the editor's top row the same way.
// Composed only from the shared primitives, like every other help scene.
import type { ReactNode } from 'react';
import { Label, Panel, Scene, Tile } from './primitives';
import { SelectGlyph } from './palette-modes-parts';
import { ModeMark, type Mode } from './mode-mark';

// The strip's element tiles, drawn as the simple outlines the real tiles use.
function ShapeGlyph({
  kind,
}: {
  kind:
    'square' | 'circle' | 'diamond' | 'text' | 'arrow' | 'cylinder' | 'parallelogram' | 'hexagon';
}) {
  const s = { className: 'stroke-slate-500', strokeWidth: 1.6, fill: 'none' } as const;
  switch (kind) {
    case 'square':
      return <rect x={-5} y={-5} width={10} height={10} rx={1.5} {...s} />;
    case 'circle':
      return <circle r={5.5} {...s} />;
    case 'diamond':
      return <path d="M0 -6 L6 0 L0 6 L-6 0 Z" {...s} />;
    case 'text':
      return <path d="M-5 -5 H5 M0 -5 V6" {...s} strokeLinecap="round" />;
    case 'arrow':
      return <path d="M-6 0 H5 M2 -3 L5 0 L2 3" {...s} strokeLinecap="round" />;
    case 'cylinder':
      return <path d="M-5 -4 a5 2 0 0 0 10 0 a5 2 0 0 0 -10 0 V4 a5 2 0 0 0 10 0 V-4" {...s} />;
    case 'parallelogram':
      return <path d="M-3 -5 H6 L3 5 H-6 Z" {...s} strokeLinejoin="round" />;
    case 'hexagon':
      return <path d="M-3 -5 H3 L6 0 L3 5 H-3 L-6 0 Z" {...s} strokeLinejoin="round" />;
  }
}

// A pill-shaped dropdown in the strip: tinted, so it reads as a menu beside
// the plain tiles, the way the real strip draws its selection mode, category
// and More controls.
function Pill({
  x,
  y,
  w,
  active = false,
  children,
}: {
  x: number;
  y: number;
  w: number;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={24}
        rx={6}
        className={active ? 'fill-brand-100 stroke-brand-300' : 'fill-brand-50 stroke-brand-100'}
        strokeWidth={1}
      />
      {children}
      <path
        d={`M${x + w - 12} ${y + 10} l3 3 l3 -3`}
        className="stroke-brand-600"
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

// Diagram's category bar, in order: category names, and '|' for the divider between the bands.
const BAR: readonly string[] = [
  'Shapes',
  'Draw',
  '|',
  'Build',
  'Concepts',
  '|',
  'Icons',
  'Tech',
  'Media',
];
// A name's width at the strip's 8.5px type, and the padding either side of it. Tight enough that the whole
// strip, Search included, fits a 420-wide scene beside the menu card (the figure scan in help-pages.md).
const charW = 4.5;
const PAD = 5;
const nameW = (name: string) => Math.round(name.length * charW + 2 * PAD);

/** The width of the strip drawn by `Strip`. */
export const STRIP_W = 49 + BAR.reduce((w, c) => w + (c === '|' ? 9 : nameW(c)), 0) + 36;

/** The palette strip as Diagram's category bar, top-left corner at (x, y), STRIP_W wide and 32 tall: the selection
 *  mode, the categories by name (`open` pressed, its flyout showing), and Search. */
export function Strip({ x, y, open }: { x: number; y: number; open?: string }) {
  const slots = barSlots(x);
  const end = slots.at(-1)!.left + slots.at(-1)!.w;
  const items = slots.map((slot, i) => {
    if (slot.name === '|')
      return (
        <path
          key={i}
          d={`M${slot.left + 4} ${y + 8}v16`}
          className="stroke-slate-200"
          strokeWidth={1}
        />
      );
    const { name, left: at, w } = slot;
    const pressed = name === open;
    return (
      <g key={name}>
        {pressed ? (
          <rect x={at} y={y + 4} width={w} height={24} rx={6} className="fill-brand-100" />
        ) : null}
        <Label
          x={at + w / 2}
          y={y + 19}
          size={8.5}
          weight={pressed ? 700 : 500}
          anchor="middle"
          className={pressed ? 'fill-brand-700' : 'fill-slate-600'}
        >
          {name}
        </Label>
        {pressed ? (
          <rect x={at + 6} y={y + 27} width={w - 12} height={2} rx={1} className="fill-brand-500" />
        ) : null}
      </g>
    );
  });

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={STRIP_W}
        height={32}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <Pill x={x + 4} y={y + 4} w={34}>
        <g transform={`translate(${x + 15} ${y + 16}) scale(0.8)`}>
          <SelectGlyph />
        </g>
      </Pill>
      <path d={`M${x + 43} ${y + 8}v16`} className="stroke-slate-200" strokeWidth={1} />
      {items}
      {/* Search, last on the strip behind its own divider. */}
      <path d={`M${end + 5} ${y + 8}v16`} className="stroke-slate-200" strokeWidth={1} />
      <circle
        cx={end + 19}
        cy={y + 15}
        r={5}
        className="fill-none stroke-slate-500"
        strokeWidth={1.6}
      />
      <path
        d={`M${end + 23} ${y + 19} l4 4`}
        className="stroke-slate-500"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </g>
  );
}

// Each of the bar's items on a strip drawn at x: its left edge and width (a divider is 9 wide).
function barSlots(x: number): { name: string; left: number; w: number }[] {
  return BAR.reduce<{ name: string; left: number; w: number }[]>((out, name) => {
    const prev = out.at(-1);
    const left = prev ? prev.left + prev.w : x + 49;
    return [...out, { name, left, w: name === '|' ? 9 : nameW(name) }];
  }, []);
}

/** Where a category's button sits on a strip drawn at x: its left edge and width. */
export function stripCategory(x: number, name: string): { left: number; w: number } {
  const slot = barSlots(x).find((s) => s.name === name);
  return slot ? { left: slot.left, w: slot.w } : { left: x, w: 0 };
}

/** The top-left card, its top-left corner at (x, y): the menu button (☰) and, unless `menuOnly`
 *  (a phone), the editor mode switch beside it. 62 wide (34 menu-only) and 32 tall. */
export function MenuCard({
  x,
  y,
  menuOnly = false,
  mode = 'Diagram',
}: {
  x: number;
  y: number;
  menuOnly?: boolean;
  mode?: Mode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={menuOnly ? 34 : 62}
        height={32}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <path
        d={`M${x + 8} ${y + 10}h14M${x + 8} ${y + 16}h14M${x + 8} ${y + 22}h14`}
        className="stroke-slate-500"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      {!menuOnly && (
        <Pill x={x + 28} y={y + 4} w={30}>
          {/* The current mode's mark, as the switch shows it. */}
          <g transform={`translate(${x + 38} ${y + 16})`}>
            <ModeMark mode={mode} className="stroke-brand-600" scale={0.45} />
          </g>
        </Pill>
      )}
    </g>
  );
}

/** The editor's top row and bottom row: the menu button and the editor mode switch top-left,
 *  the strip across the top (ending in Search), and Undo and Redo, Layers and the Theme
 *  paintbrush, then the zoom bottom-right. */
export function ToolbarLayoutOverview() {
  const leader = { className: 'stroke-slate-300', strokeWidth: 1 } as const;
  const ink = { className: 'stroke-slate-500', strokeWidth: 1.4, fill: 'none' } as const;
  return (
    <Scene w={420} h={200}>
      <MenuCard x={8} y={16} />
      <Strip x={78} y={16} />
      {/* Two rows of labels: side by side, neighbouring labels ran into each other. The lower row
          hangs from its control on a thin leader through the gap in the row above. */}
      <Label x={10} y={62} size={10} tone="muted">
        Explorer, mode
      </Label>
      <line x1={99} y1={51} x2={99} y2={70} {...leader} />
      <Label x={99} y={80} size={10} anchor="middle" tone="muted">
        Selection mode
      </Label>
      <line x1={250} y1={51} x2={250} y2={70} {...leader} />
      <Label x={250} y={80} size={10} anchor="middle" tone="accent" weight={700}>
        Categories
      </Label>
      <line x1={78 + STRIP_W - 18} y1={51} x2={78 + STRIP_W - 18} y2={70} {...leader} />
      <Label x={78 + STRIP_W - 18} y={80} size={10} anchor="middle" tone="muted">
        Search
      </Label>
      {/* The bottom row: Undo and Redo, Layers and the paintbrush, then zoom. */}
      <rect
        x={170}
        y={158}
        width={60}
        height={26}
        rx={6}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <line x1={200} y1={163} x2={200} y2={179} className="stroke-slate-200" strokeWidth={1.2} />
      <path d="M190 168 h-8 l3 -3 M182 168 l3 3 M182 168 h5 a4.5 4.5 0 0 1 0 9 h-2" {...ink} />
      <path d="M210 168 h8 l-3 -3 M218 168 l-3 3 M218 168 h-5 a4.5 4.5 0 0 0 0 9 h2" {...ink} />
      <rect
        x={238}
        y={158}
        width={60}
        height={26}
        rx={6}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <line x1={268} y1={163} x2={268} y2={179} className="stroke-slate-200" strokeWidth={1.2} />
      <path
        d="M247 170 L253 167 L259 170 L253 173 Z M247 174 L253 177 L259 174"
        {...ink}
        strokeLinejoin="round"
      />
      <path
        d="M286 164 l2 2 l-6 6 l-2 -2 Z M280 172 c-2.5 0 -3.5 1.5 -3.5 4 c2.5 0 4 -1 4 -3.5"
        {...ink}
        strokeLinejoin="round"
      />
      <rect
        x={306}
        y={158}
        width={98}
        height={26}
        rx={6}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={355} y={172} size={10} anchor="middle" tone="muted">
        100%
      </Label>
    </Scene>
  );
}

/** A category open: resting on Shapes hangs its flyout under it, its tiles in named groups. */
export function ToolbarCategoryFlyout() {
  const groups = [
    { title: 'Basics', tiles: ['square', 'circle', 'diamond'] as const },
    { title: 'Flowchart', tiles: ['cylinder', 'parallelogram', 'hexagon'] as const },
  ];
  const shapes = stripCategory(78, 'Shapes');
  const panelX = Math.round(shapes.left + shapes.w / 2 - 90);
  return (
    <Scene w={420} h={236}>
      <MenuCard x={8} y={16} />
      <Strip x={78} y={16} open="Shapes" />
      <Panel x={panelX} y={58} w={180} h={166} title="SHAPES">
        {groups.map((g, gi) => (
          <g key={g.title}>
            <Label x={panelX + 10} y={96 + gi * 60} size={9} weight={600} tone="muted">
              {g.title}
            </Label>
            {g.tiles.map((kind, i) => (
              <Tile key={kind} x={panelX + 10 + i * 54} y={102 + gi * 60} size={34}>
                <ShapeGlyph kind={kind} />
              </Tile>
            ))}
          </g>
        ))}
      </Panel>
    </Scene>
  );
}
