// Scenes for the Toolbar Layout article (docs/specs/007-editor/toolbar-layout.md): the strip across the top
// of the canvas, and More opening a category's full palette under itself. `Strip` and `MenuCard`
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

function Ellipsis({ x, y }: { x: number; y: number }) {
  return (
    <g className="fill-brand-600">
      <circle cx={x} cy={y} r={1.6} />
      <circle cx={x + 5} cy={y} r={1.6} />
      <circle cx={x + 10} cy={y} r={1.6} />
    </g>
  );
}

/** The palette strip, top-left corner at (x, y), 304 wide and 32 tall. */
export function Strip({
  x,
  y,
  moreActive = false,
  // Diagram mode opens the palette on Popular.
  category = 'Popular',
}: {
  x: number;
  y: number;
  moreActive?: boolean;
  category?: string;
}) {
  // The category's first five tiles, in the app's order: Popular leads with words and an arrow
  // after the basic shapes, Shapes carries on with more outlines.
  const tiles =
    category === 'Popular'
      ? (['square', 'circle', 'diamond', 'text', 'arrow'] as const)
      : (['square', 'circle', 'diamond', 'cylinder', 'parallelogram'] as const);
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={304}
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
      <Pill x={x + 47} y={y + 4} w={72}>
        <Label x={x + 55} y={y + 17} size={10} weight={600} className="fill-brand-700">
          {category}
        </Label>
      </Pill>
      <path d={`M${x + 124} ${y + 8}v16`} className="stroke-slate-200" strokeWidth={1} />
      {tiles.map((kind, i) => (
        <g key={kind} transform={`translate(${x + 140 + i * 20} ${y + 16})`}>
          <ShapeGlyph kind={kind} />
        </g>
      ))}
      <path d={`M${x + 228} ${y + 8}v16`} className="stroke-slate-200" strokeWidth={1} />
      <Pill x={x + 232} y={y + 4} w={38} active={moreActive}>
        <Ellipsis x={x + 238} y={y + 16} />
      </Pill>
      {/* Search, last on the strip behind its own divider. */}
      <path d={`M${x + 275} ${y + 8}v16`} className="stroke-slate-200" strokeWidth={1} />
      <circle
        cx={x + 287}
        cy={y + 15}
        r={5}
        className="fill-none stroke-slate-500"
        strokeWidth={1.6}
      />
      <path
        d={`M${x + 291} ${y + 19} l4 4`}
        className="stroke-slate-500"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </g>
  );
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
      <Label x={162} y={62} size={10} anchor="middle" tone="muted">
        Category
      </Label>
      <line x1={258} y1={51} x2={258} y2={70} {...leader} />
      <Label x={258} y={80} size={10} anchor="middle" tone="muted">
        Up to twelve tiles
      </Label>
      <Label x={329} y={62} size={10} anchor="middle" tone="accent" weight={700}>
        More
      </Label>
      <line x1={366} y1={51} x2={366} y2={70} {...leader} />
      <Label x={366} y={80} size={10} anchor="middle" tone="muted">
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

/** More open: the current category's full palette, hanging from the button. */
export function ToolbarMorePopover() {
  const grid = ['square', 'circle', 'diamond', 'cylinder', 'parallelogram', 'hexagon'] as const;
  return (
    <Scene w={420} h={220}>
      <Strip x={78} y={16} moreActive />
      {/* Right edge under the More button's right edge (78 + 232 + 38). */}
      <Panel x={185} y={58} w={164} h={148} title="SHAPES">
        <rect
          x={195}
          y={88}
          width={144}
          height={18}
          rx={5}
          className="fill-slate-50 stroke-slate-200"
          strokeWidth={1}
        />
        <Label x={202} y={98} size={10} tone="muted">
          Search
        </Label>
        {grid.map((kind, i) => (
          <Tile key={i} x={197 + (i % 3) * 50} y={116 + Math.floor(i / 3) * 42} size={30}>
            <ShapeGlyph kind={kind} />
          </Tile>
        ))}
      </Panel>
    </Scene>
  );
}
