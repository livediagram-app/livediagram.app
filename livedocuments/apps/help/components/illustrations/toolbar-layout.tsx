// Scenes for the Toolbar Layout article (docs/specs/007-editor/toolbar-layout.md): the strip across the top
// of the canvas as the category bar, and a category's flyout opening under it. `Strip` and `MenuCard`
// are exported so other scenes draw the editor's top row the same way.
// Composed only from the shared primitives, like every other help scene.
import type { ReactNode } from 'react';
import { Label, Panel, Scene, Tile } from './primitives';
import { SelectGlyph } from './palette-modes-parts';

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

// A pill-shaped dropdown in the strip: tinted, so it reads as a menu beside the category bar's plain buttons, the
// way the real strip draws its selection mode.
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

/** The category bar's categories on an infographic page, in order (apps/editor palette-layouts.ts), with '|' for the
 *  divider between the bands. */
export const BAR: readonly string[] = [
  'Shapes',
  'Write',
  '|',
  'Concepts',
  'Components',
  'Devices',
  '|',
  'Icons',
  'Stickers',
  'Media',
  '|',
  'Data',
];

/** A category's glyph on the bar, centred on the origin and about 12 units across: the universal symbol for it. */
export function BarGlyph({ name, active = false }: { name: string; active?: boolean }) {
  const s = {
    className: active ? 'stroke-brand-700' : 'stroke-slate-500',
    strokeWidth: 1.4,
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
  const dot = active ? 'fill-brand-700' : 'fill-slate-500';
  switch (name) {
    case 'Shapes':
      return (
        <g>
          <rect x={-6} y={-6} width={7} height={7} rx={1} {...s} />
          <circle cx={2.5} cy={2.5} r={3.5} {...s} />
        </g>
      );
    case 'Write':
      return <path d="M-5 -5 H5 M0 -5 V6" {...s} />;
    case 'Concepts':
      return (
        <g>
          <path d="M-3.5 -3 H3.5 M-3.5 -3 L0 3.5" {...s} />
          <circle cx={-4} cy={-3.5} r={2} {...s} />
          <circle cx={4} cy={-3.5} r={2} {...s} />
          <circle cx={0} cy={4} r={2} {...s} />
        </g>
      );
    case 'Components':
      return (
        <g>
          <rect x={-6} y={-5} width={12} height={10} rx={1.5} {...s} />
          <path d="M-6 -1 H6 M-3.5 2 H1" {...s} />
        </g>
      );
    case 'Devices':
      return (
        <g>
          <rect x={-3.5} y={-6} width={7} height={12} rx={1.5} {...s} />
          <path d="M-1 3.5 H1" {...s} />
        </g>
      );
    case 'Icons':
      return (
        <path
          d="M0 -6 L1.8 -1.9 L6 -1.6 L2.8 1.2 L3.7 5.5 L0 3.2 L-3.7 5.5 L-2.8 1.2 L-6 -1.6 L-1.8 -1.9 Z"
          {...s}
        />
      );
    case 'Stickers':
      return (
        <g>
          <circle r={5.5} {...s} />
          <path d="M-2.5 1.5 Q0 4 2.5 1.5" {...s} />
          <circle cx={-2} cy={-1.5} r={0.8} className={dot} />
          <circle cx={2} cy={-1.5} r={0.8} className={dot} />
        </g>
      );
    case 'Media':
      return (
        <g>
          <rect x={-6} y={-5} width={12} height={10} rx={1.5} {...s} />
          <path d="M-6 3.5 L-2 -0.5 L1 2.5 L3 0.5 L6 3.5" {...s} />
          <circle cx={2.5} cy={-2} r={1} className={dot} />
        </g>
      );
    case 'Data':
      return <path d="M-4 5 V1 M0 5 V-5 M4 5 V-2" {...s} />;
    default:
      return null;
  }
}

// A category's button on the strip, and a divider between the bands. The scenes draw the bar as glyphs alone, as the
// editor does where the strip has no room for the names: with them, a page's whole bar would not fit a 420-wide scene
// beside the menu card.
const SLOT_W = 20;
const DIVIDER_W = 9;

/** The width of the strip drawn by `Strip`. */
export const STRIP_W = 49 + BAR.reduce((w, c) => w + (c === '|' ? DIVIDER_W : SLOT_W), 0) + 36;

/** The palette strip, top-left corner at (x, y), STRIP_W wide and 32 tall: the selection mode, the category bar (its
 *  categories as glyphs, `open` pressed with its flyout showing), and Search. */
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
          <rect x={at + 1} y={y + 4} width={w - 2} height={24} rx={6} className="fill-brand-100" />
        ) : null}
        <g transform={`translate(${at + w / 2} ${y + 16})`}>
          <BarGlyph name={name} active={pressed} />
        </g>
        {pressed ? (
          <rect x={at + 5} y={y + 27} width={w - 10} height={2} rx={1} className="fill-brand-500" />
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

// Each of the bar's items on a strip drawn at x: its left edge and width.
function barSlots(x: number): { name: string; left: number; w: number }[] {
  return BAR.reduce<{ name: string; left: number; w: number }[]>((out, name) => {
    const prev = out.at(-1);
    const left = prev ? prev.left + prev.w : x + 49;
    return [...out, { name, left, w: name === '|' ? DIVIDER_W : SLOT_W }];
  }, []);
}

/** Where a category's button sits on a strip drawn at x: its left edge and width. */
export function stripCategory(x: number, name: string): { left: number; w: number } {
  const slot = barSlots(x).find((s) => s.name === name);
  return slot ? { left: slot.left, w: slot.w } : { left: x, w: 0 };
}

/** The top-left card, its top-left corner at (x, y): the menu button (☰) and, unless `menuOnly`
 *  (a phone), the open tab's name beside it. 62 wide (34 menu-only) and 32 tall. */
export function MenuCard({ x, y, menuOnly = false }: { x: number; y: number; menuOnly?: boolean }) {
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
        <>
          <line x1={x + 29} y1={y + 9} x2={x + 29} y2={y + 23} className="stroke-slate-200" />
          <Label x={x + 34} y={y + 16} size={10} tone="strong">
            Tab 1
          </Label>
        </>
      )}
    </g>
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
