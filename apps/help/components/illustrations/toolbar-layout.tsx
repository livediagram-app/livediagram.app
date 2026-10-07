// Scenes for the Toolbar Layout article (docs/specs/007-editor/toolbar-layout.md): the strip across the top
// of the canvas, and More opening a category's full palette under itself.
// Composed only from the shared primitives, like every other help scene.
import type { ReactNode } from 'react';
import { Label, Panel, Scene, Tile } from './primitives';
import { SelectGlyph } from './palette-modes-parts';

// The strip's element tiles, drawn as the simple outlines the real tiles use.
function ShapeGlyph({ kind }: { kind: 'square' | 'circle' | 'diamond' | 'text' | 'arrow' }) {
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

// The strip itself, top-left corner at (x, y). Shared by both scenes.
function Strip({ x, y, moreActive = false }: { x: number; y: number; moreActive?: boolean }) {
  const tiles = ['square', 'circle', 'diamond', 'text', 'arrow'] as const;
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
          Shapes
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

/** The whole layout: the menu button and the editor mode switch top-left, the
 *  strip across the top (ending in Search), and the Floating layout's bottom
 *  row kept as it was. */
export function ToolbarLayoutOverview() {
  return (
    <Scene w={420} h={200}>
      {/* The top-left card: the menu button and the editor mode switch. */}
      <rect
        x={8}
        y={16}
        width={62}
        height={32}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <path
        d="M16 26h14M16 32h14M16 38h14"
        className="stroke-slate-500"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Pill x={36} y={20} w={30}>
        <rect x={41} y={27} width={10} height={10} rx={2} className="fill-none stroke-brand-600" />
      </Pill>
      <Strip x={78} y={16} />
      <Label x={39} y={62} size={10} anchor="middle" tone="muted">
        Explorer, mode
      </Label>
      <Label x={99} y={78} size={10} anchor="middle" tone="muted">
        Selection mode
      </Label>
      {/* Alternate rows: side by side, neighbouring labels ran into each other. */}
      <Label x={162} y={62} size={10} anchor="middle" tone="muted">
        Category
      </Label>
      <Label x={258} y={78} size={10} anchor="middle" tone="muted">
        Up to twelve tiles
      </Label>
      <Label x={329} y={62} size={10} anchor="middle" tone="accent" weight={700}>
        More
      </Label>
      <Label x={366} y={78} size={10} anchor="middle" tone="muted">
        Search
      </Label>
      {/* The bottom row, unchanged from Floating: Layers, then zoom. */}
      <Tile x={290} y={158} size={26}>
        <path
          d="M-6 -1 L0 -4 L6 -1 L0 2 Z M-6 3 L0 6 L6 3"
          className="stroke-slate-500"
          strokeWidth={1.4}
          fill="none"
          strokeLinejoin="round"
        />
      </Tile>
      <rect
        x={322}
        y={158}
        width={82}
        height={26}
        rx={6}
        className="fill-slate-50 stroke-slate-200"
        strokeWidth={1.5}
      />
      <Label x={363} y={172} size={10} anchor="middle" tone="muted">
        100%
      </Label>
    </Scene>
  );
}

/** More open: the current category's full palette, hanging from the button. */
export function ToolbarMorePopover() {
  const grid = ['square', 'circle', 'diamond', 'text', 'arrow', 'square'] as const;
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
