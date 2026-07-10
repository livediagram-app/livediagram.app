import type { ComponentKind, ShapeKind } from '@livediagram/diagram';
import type { PendingDraw } from '@/lib/draw-mode';
import { IconButton } from '@/components/palette/palette-controls';
import { ICON_DND_MIME } from '@/lib/icons';
import { TECH_ICON_DND_MIME } from '@/lib/tech-icons';
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
  // Dynamic icon favourites (spec/78): drop a single line-art / Technology
  // catalogue icon, same handlers the Icons / Technology tabs use.
  addIcon: (iconId: string) => void;
  addTechIcon: (iconId: string) => void;
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
    case 'icon':
      return () => actions.addIcon(a.iconId);
    case 'tech-icon':
      return () => actions.addTechIcon(a.iconId);
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
    // Icon tiles drop immediately too (matching the Icons / Technology
    // tabs, which carry no pressed state).
    case 'table':
    case 'annotation':
    case 'link-card':
    case 'icon':
    case 'tech-icon':
      return false;
    default:
      return pendingDraw.type === a.type;
  }
}

export function visibleTiles(defs: PaletteTileDef[], hasImage: boolean): PaletteTileDef[] {
  return defs.filter((d) => !d.needsImage || hasImage);
}

// One catalogue tile, rendered exactly as its home tab renders it.
// (Favourites curation happens in the edit-favourites dialog, not by
// overlaying badges here — see PaletteFavouritesDialog.)
function PaletteTile({
  def,
  actions,
  pendingDraw,
}: {
  def: PaletteTileDef;
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null | undefined;
}) {
  const a = def.action;
  // Icon favourites keep their home tabs' drag affordance: a line icon drags
  // onto a shape to set its inline icon, a tech icon drags onto the canvas.
  const iconDrag =
    a.type === 'icon' || a.type === 'tech-icon'
      ? (e: React.DragEvent) => {
          e.dataTransfer.setData(a.type === 'icon' ? ICON_DND_MIME : TECH_ICON_DND_MIME, a.iconId);
          e.dataTransfer.effectAllowed = 'copy';
        }
      : undefined;
  return (
    <IconButton
      label={def.label}
      caption={def.caption}
      description={def.description}
      onClick={tileHandler(def, actions)}
      dragKind={a.type === 'shape' ? a.kind : undefined}
      draggable={iconDrag !== undefined || undefined}
      onDragStart={iconDrag}
      filled={def.filled}
      noTint={def.noTint}
      active={tileActive(def, pendingDraw)}
      shortcut={def.shortcut}
    >
      {def.icon}
    </IconButton>
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
}: {
  section?: PaletteTileSection;
  tiles?: PaletteTileDef[];
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null | undefined;
}) {
  const defs = visibleTiles(tiles ?? (section ? tilesInSection(section) : []), actions.hasImage);
  return (
    // 3-column grid of fixed tiles (matching the Icons catalogue) so tiles
    // pack into even rows; overflow-x-hidden absorbs the few-px slack when
    // fixed tiles slightly exceed the cell width.
    <div className="grid grid-cols-3 justify-items-center gap-1 overflow-x-hidden">
      {defs.map((def) => (
        <PaletteTile key={def.id} def={def} actions={actions} pendingDraw={pendingDraw} />
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
