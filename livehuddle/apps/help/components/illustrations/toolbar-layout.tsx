// Scenes for the Toolbar Layout article (docs/specs/007-editor/toolbar-layout.md): the strip across the top
// of the canvas as the category bar, and a category's flyout opening under it. `Strip` and `MenuCard`
// are exported so other scenes draw the editor's top row the same way.
// Composed only from the shared primitives, like every other help scene.
import { Label, Panel, Scene, Tile } from '@liveworkspace/help-site/art/primitives';
import { EditWalkToggle, editWalkToggleWidth } from './palette-modes-parts';

// The strip's element tiles, drawn as the simple outlines the real tiles use.
function SpaceGlyph({
  kind,
}: {
  kind: 'portal' | 'chair' | 'desk' | 'room' | 'table' | 'plant' | 'sofa';
}) {
  const s = { className: 'stroke-slate-500', strokeWidth: 1.6, fill: 'none' } as const;
  switch (kind) {
    case 'portal':
      return <ellipse rx={4.5} ry={6.5} {...s} />;
    case 'chair':
      return <path d="M-4 -6 V5 M-4 1 H4 V5 M4 1 V-1" {...s} strokeLinecap="round" />;
    case 'desk':
      return (
        <path d="M-7 -2 H7 M-5 -2 V6 M5 -2 V6 M-2 -2 V-6 H3 V-2" {...s} strokeLinecap="round" />
      );
    case 'sofa':
      return (
        <path
          d="M-7 0 V5 H7 V0 M-5 0 V-4 H5 V0 M-7 0 H-5 M5 0 H7 M-5 2 H5"
          {...s}
          strokeLinejoin="round"
        />
      );
    case 'room':
      return <path d="M-2 -6 H-6 V6 H6 V-6 H2" {...s} strokeLinejoin="round" />;
    case 'table':
      return (
        <g>
          <rect x={-5} y={-3} width={10} height={6} rx={2} {...s} />
          <path d="M-3 -6 H3 M-3 6 H3" {...s} strokeLinecap="round" />
        </g>
      );
    case 'plant':
      return (
        <path
          d="M-4 2 H4 L3 7 H-3 Z M0 2 V-2 M0 -2 C-4 -2 -5 -5 -5 -7 C-2 -7 0 -5 0 -2 C0 -5 2 -7 5 -7 C5 -5 4 -2 0 -2"
          {...s}
          strokeLinejoin="round"
        />
      );
  }
}

// The meeting palette's category bar, as many of its categories as the figure has room for beside the Edit | Walk
// toggle, in order: category names, and '|' for the divider between the bands.
const BAR: readonly string[] = ['Write', '|', 'Rooms', 'Seats', '|', 'Travel'];
// A name's width at the strip's 8.5px type, and the padding either side of it. Tight enough that the whole
// strip, Search included, fits a 420-wide scene beside the menu card (the figure scan in help-pages.md).
const charW = 4.5;
const PAD = 5;
const nameW = (name: string) => Math.round(name.length * charW + 2 * PAD);
// Where the category bar starts, past the Edit | Walk toggle (4 in from the strip's edge) and its divider.
const BAR_START = 4 + editWalkToggleWidth() + 11;

/** The width of the strip drawn by `Strip`. */
export const STRIP_W = BAR_START + BAR.reduce((w, c) => w + (c === '|' ? 9 : nameW(c)), 0) + 36;

/** The palette strip as an Editor sees it while building, top-left corner at (x, y), STRIP_W wide and 32 tall: the
 *  Edit | Walk toggle (Edit on), the categories by name (`open` pressed, its flyout showing), and Search. */
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
      <EditWalkToggle x={x + 4} y={y + 4} on="edit" />
      <path d={`M${x + BAR_START - 6} ${y + 8}v16`} className="stroke-slate-200" strokeWidth={1} />
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
    const left = prev ? prev.left + prev.w : x + BAR_START;
    return [...out, { name, left, w: name === '|' ? 9 : nameW(name) }];
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

/** The editor's top row and bottom row: the menu button and the tab's name top-left,
 *  the strip across the top (ending in Search), and Undo and Redo, the Theme
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
        Explorer, tab
      </Label>
      <line x1={124} y1={51} x2={124} y2={70} {...leader} />
      <Label x={124} y={80} size={10} anchor="middle" tone="muted">
        Edit | Walk
      </Label>
      <line x1={250} y1={51} x2={250} y2={70} {...leader} />
      <Label x={250} y={80} size={10} anchor="middle" tone="accent" weight={700}>
        Categories
      </Label>
      <line x1={78 + STRIP_W - 18} y1={51} x2={78 + STRIP_W - 18} y2={70} {...leader} />
      <Label x={78 + STRIP_W - 18} y={80} size={10} anchor="middle" tone="muted">
        Search
      </Label>
      {/* The bottom row: Undo and Redo, the paintbrush, then zoom. */}
      <g transform="translate(28 0)">
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
          width={32}
          height={26}
          rx={6}
          className="fill-white stroke-slate-200"
          strokeWidth={1.5}
        />
        <path
          d="M258 164 l2 2 l-6 6 l-2 -2 Z M252 172 c-2.5 0 -3.5 1.5 -3.5 4 c2.5 0 4 -1 4 -3.5"
          {...ink}
          strokeLinejoin="round"
        />
      </g>
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

/** A category open: resting on Seats hangs its flyout under it, its tiles in one block. */
export function ToolbarCategoryFlyout() {
  const tiles = ['chair', 'desk', 'sofa', 'table'] as const;
  const seating = stripCategory(78, 'Seats');
  const panelX = Math.round(seating.left + seating.w / 2 - 90);
  return (
    <Scene w={420} h={236}>
      <MenuCard x={8} y={16} />
      <Strip x={78} y={16} open="Seats" />
      <Panel x={panelX} y={58} w={180} h={126} title="SEATING">
        {tiles.map((kind, i) => (
          <Tile key={kind} x={panelX + 10 + (i % 3) * 54} y={90 + Math.floor(i / 3) * 44} size={34}>
            <SpaceGlyph kind={kind} />
          </Tile>
        ))}
      </Panel>
    </Scene>
  );
}
