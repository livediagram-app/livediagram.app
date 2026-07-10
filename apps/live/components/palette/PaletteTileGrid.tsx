import type { ComponentKind, ShapeKind } from '@livediagram/diagram';
import type { PendingDraw } from '@/lib/draw-mode';
import { IconButton } from '@/components/palette/palette-controls';
import type { PaletteTileDef, PaletteTileSection } from './palette-tile-defs';
import { tilesInSection } from './palette-tile-defs';

// Renders palette tiles from the shared catalogue (palette-tile-defs,
// spec/78): maps each tile's action descriptor to the editor's add-handler
// bundle and derives the pending-draw highlight, so the category tabs and
// the Favourites grid share one tile implementation.

// The editor add-handlers a tile can invoke, bundled once in CommandPalette
// (with the mobile-close / draw-armed wrapping already applied) and threaded
// to every grid.
export type PaletteTileActions = {
  addShape: (kind: ShapeKind) => void;
  addText: () => void;
  beginFreehand: () => void;
  addArrow: () => void;
  addSticky: () => void;
  addTable: () => void;
  addImage: () => void;
  addAnnotation: () => void;
  addLinkCard: () => void;
  addComponent: (kind: ComponentKind) => void;
  // Whether image uploads are available (the editor supplied onAddImage);
  // gates the `needsImage` tiles exactly as the Tools / Components tabs
  // always have.
  hasImage: boolean;
};

function tileHandler(def: PaletteTileDef, actions: PaletteTileActions): () => void {
  const a = def.action;
  switch (a.type) {
    case 'shape':
      return () => actions.addShape(a.kind);
    case 'text':
      return actions.addText;
    case 'freehand':
      return actions.beginFreehand;
    case 'arrow':
      return actions.addArrow;
    case 'sticky':
      return actions.addSticky;
    case 'table':
      return actions.addTable;
    case 'image':
      return actions.addImage;
    case 'annotation':
      return actions.addAnnotation;
    case 'link-card':
      return actions.addLinkCard;
    case 'component':
      return () => actions.addComponent(a.kind);
  }
}

// Whether this tile is the armed draw-to-size intent (the pressed
// highlight). Table / annotation / link-card drop immediately and never
// arm, so they have no active state.
function tileActive(def: PaletteTileDef, pendingDraw: PendingDraw | null | undefined): boolean {
  if (!pendingDraw) return false;
  const a = def.action;
  switch (a.type) {
    case 'shape':
      return pendingDraw.type === 'shape' && pendingDraw.kind === a.kind;
    case 'component':
      return pendingDraw.type === 'component' && pendingDraw.kind === a.kind;
    case 'table':
    case 'annotation':
    case 'link-card':
      return false;
    default:
      return pendingDraw.type === a.type;
  }
}

export function visibleTiles(defs: PaletteTileDef[], hasImage: boolean): PaletteTileDef[] {
  return defs.filter((d) => !d.needsImage || hasImage);
}

// One catalogue tile. `editBadge` flips it into the Favourites edit-mode
// treatment (spec/78): the click curates instead of creating, the tile
// stops being a drag source, and a corner add / remove badge is overlaid.
export function PaletteTile({
  def,
  actions,
  pendingDraw,
  editBadge,
  onEditToggle,
}: {
  def: PaletteTileDef;
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null | undefined;
  editBadge?: 'add' | 'remove';
  onEditToggle?: () => void;
}) {
  const button = (
    <IconButton
      label={
        editBadge ? `${editBadge === 'add' ? 'Add' : 'Remove'} favourite: ${def.label}` : def.label
      }
      caption={def.caption}
      description={def.description}
      onClick={editBadge ? (onEditToggle ?? (() => {})) : tileHandler(def, actions)}
      dragKind={!editBadge && def.action.type === 'shape' ? def.action.kind : undefined}
      filled={def.filled}
      noTint={def.noTint}
      active={!editBadge && tileActive(def, pendingDraw)}
      shortcut={editBadge ? undefined : def.shortcut}
    >
      {def.icon}
    </IconButton>
  );
  if (!editBadge) return button;
  return (
    <div className="relative w-full">
      {button}
      <span
        aria-hidden
        className={`pointer-events-none absolute -left-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-white shadow-sm ${
          editBadge === 'add' ? 'bg-emerald-500' : 'bg-red-500'
        }`}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
          <path
            d={editBadge === 'add' ? 'M4 1v6M1 4h6' : 'M1 4h6'}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </div>
  );
}

// The standard 3-column tile grid every creation category uses. Pass a
// section to render its catalogue slice, or explicit `tiles` (the
// Favourites grid passes its saved list).
export function PaletteTileGrid({
  section,
  tiles,
  actions,
  pendingDraw,
  editBadge,
  onEditToggle,
}: {
  section?: PaletteTileSection;
  tiles?: PaletteTileDef[];
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null | undefined;
  editBadge?: 'add' | 'remove';
  onEditToggle?: (id: string) => void;
}) {
  const defs = visibleTiles(tiles ?? (section ? tilesInSection(section) : []), actions.hasImage);
  return (
    // 3-column grid of fixed tiles (matching the Icons catalogue) so tiles
    // pack into even rows; overflow-x-hidden absorbs the few-px slack when
    // fixed tiles slightly exceed the cell width.
    <div className="grid grid-cols-3 justify-items-center gap-1 overflow-x-hidden">
      {defs.map((def) => (
        <PaletteTile
          key={def.id}
          def={def}
          actions={actions}
          pendingDraw={pendingDraw}
          editBadge={editBadge}
          onEditToggle={onEditToggle ? () => onEditToggle(def.id) : undefined}
        />
      ))}
    </div>
  );
}

// A sub-category heading inside a tab (the Tools tab's Tools / Data split,
// the Favourites edit-mode groups). A lightweight divider, NOT an accordion.
// The first heading drops its top padding so the section sits flush with
// the panel.
export function PaletteSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-1 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 first:pt-0.5 dark:text-slate-500">
      {children}
    </div>
  );
}
