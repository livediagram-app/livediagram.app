import type {
  ComponentKind,
  EstimateScale,
  Reaction,
  SelectionMode,
  SessionTool,
  ShapeKind,
} from '@livediagram/diagram';
import type { EmbedProvider, EventStormingNoteKind } from '@livediagram/diagram';
import { eventStormingNoteSize } from '@livediagram/diagram';
import type { PendingDraw } from '@/lib/draw-mode';
import { IconButton } from '@/components/palette/palette-controls';
import { ICON_DND_MIME, PALETTE_DND_MIME } from '@/lib/icons';
import { TECH_ICON_DND_MIME } from '@/lib/tech-icons';
import { setPaletteDragPreview, suppressNativeDragImage } from '@/lib/palette-drag-preview';
import type { PaletteTileDef, PaletteTileSection } from './palette-tile-defs';
import { usePaletteRecent } from './palette-recent-context';
import { tilesInSection } from './palette-tile-defs';

// Renders palette tiles from the shared catalogue (palette-tile-defs,
// spec/78): maps each tile's action descriptor to the editor's add-handler
// bundle and derives the pending-draw highlight, so the category tabs and
// the Favourites grid share one tile implementation.

// The editor add-handlers a tile can invoke, bundled once in CommandPalette
// (with the mobile-close / draw-armed wrapping already applied) and threaded
// to every grid.
export type PaletteTileActions = {
  addShape: (
    kind: ShapeKind,
    opts?: {
      session?: SessionTool;
      reaction?: Reaction;
      mode?: SelectionMode;
      estimateScale?: EstimateScale;
    },
  ) => void;
  addText: () => void;
  beginFreehand: () => void;
  beginShapePen: () => void;
  beginPolygon: () => void;
  addArrow: () => void;
  // Optional fill + kind: the Event Storming tiles pass their note kind's
  // canonical colour and the kind itself (which routes the note onto its
  // stage's layer, spec/139); plain "Add sticky note" passes nothing.
  addSticky: (fill?: string, esKind?: EventStormingNoteKind) => void;
  addTable: () => void;
  addImage: () => void;
  addAnnotation: () => void;
  addLinkCard: () => void;
  addVideo: (provider?: EmbedProvider) => void;
  addSticker: (stickerId: string) => void;
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

export function tileHandler(def: PaletteTileDef, actions: PaletteTileActions): () => void {
  const a = def.action;
  switch (a.type) {
    case 'shape':
      // The creation-time choice rides along, so "Add poll" places a poll and
      // a confetti tile places a confetti pad (spec/105, spec/135).
      return () =>
        actions.addShape(a.kind, {
          session: a.session,
          reaction: a.reaction,
          mode: a.mode,
          estimateScale: a.estimateScale,
        });
    case 'text':
      return actions.addText;
    case 'freehand':
      return actions.beginFreehand;
    case 'shape-pen':
      return actions.beginShapePen;
    case 'polygon':
      return actions.beginPolygon;
    case 'arrow':
      return actions.addArrow;
    case 'sticky':
      // Wrapped so the button's MouseEvent can't land in the optional fill
      // parameter; the tile's own fill + kind (if any) ride instead.
      return () => actions.addSticky(a.fill, a.esKind);
    case 'table':
      return actions.addTable;
    case 'image':
      return actions.addImage;
    case 'annotation':
      return actions.addAnnotation;
    case 'link-card':
      return actions.addLinkCard;
    case 'video':
      return () => actions.addVideo(a.provider);
    case 'sticker':
      return () => actions.addSticker(a.stickerId);
    case 'component':
      return () => actions.addComponent(a.kind);
    case 'icon':
      return () => actions.addIcon(a.iconId);
    case 'tech-icon':
      return () => actions.addTechIcon(a.iconId);
  }
}

// Whether this tile is the armed draw-to-size intent (the pressed
// highlight). Only the annotation drops immediately and never arms, so it is
// the only kind with no active state (spec/09 "Placement on add").
export function tileActive(
  def: PaletteTileDef,
  pendingDraw: PendingDraw | null | undefined,
): boolean {
  if (!pendingDraw) return false;
  const a = def.action;
  switch (a.type) {
    case 'shape':
      // Matched on the CHOICE too, or all five reaction tiles would light up
      // together while one of them was armed.
      return (
        pendingDraw.type === 'shape' &&
        pendingDraw.kind === a.kind &&
        pendingDraw.session === a.session &&
        pendingDraw.reaction === a.reaction &&
        pendingDraw.mode === a.mode &&
        pendingDraw.estimateScale === a.estimateScale
      );
    case 'component':
      return pendingDraw.type === 'component' && pendingDraw.kind === a.kind;
    // The three pens share the freehand intent, split by the variant
    // payload — each tile lights only for its own arm (spec/115).
    case 'freehand':
      return pendingDraw.type === 'freehand' && pendingDraw.variant === undefined;
    case 'shape-pen':
      return pendingDraw.type === 'freehand' && pendingDraw.variant === 'shape-pen';
    // The Media tab has a tile per service and they all arm one `video`
    // intent, so match on the provider too or picking Loom would light up
    // Vimeo alongside it (the same trap the shape branch above avoids).
    case 'video':
      return pendingDraw.type === 'video' && pendingDraw.provider === a.provider;
    // The Event Storming tiles all arm the one sticky intent, split by the
    // fill + kind payload — match on both or arming Command would light up
    // all eight notes plus the plain sticky tile (the video / shape trap).
    case 'sticky':
      return (
        pendingDraw.type === 'sticky' &&
        pendingDraw.fill === a.fill &&
        pendingDraw.esKind === a.esKind
      );
    // Icon / sticker tiles DO arm (they ride the shape intent carrying their
    // glyph id), but their catalogues are open-ended and the picker tabs
    // render thousands of tiles, so pressed-state matching per glyph buys
    // nothing the mode banner and cursor don't already say.
    case 'annotation':
    case 'sticker':
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
// overlaying badges here — see PaletteFavouritesDialog.) `compact` is the
// Toolbar layout's strip (spec/148): icon only, name in the tooltip, and the
// shortcut letter always showing in the corner rather than only while the
// modifier is held, the way a tool bar reads.
// A tile's click handler, which in the Toolbar layout also records the use,
// so the strip can bring the tile to its front (spec/148). Everywhere else it
// is exactly tileHandler.
export function useTileHandler(def: PaletteTileDef, actions: PaletteTileActions): () => void {
  const recent = usePaletteRecent();
  const handler = tileHandler(def, actions);
  if (!recent) return handler;
  return () => {
    recent.onUse(def.id);
    handler();
  };
}

export function PaletteTile({
  def,
  actions,
  pendingDraw,
  compact,
}: {
  def: PaletteTileDef;
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null | undefined;
  compact?: boolean;
}) {
  const a = def.action;
  const onClick = useTileHandler(def, actions);
  const recent = usePaletteRecent();
  // Icon favourites keep their home tabs' drag affordance: a line icon drags
  // onto a shape to set its inline icon, a tech icon drags onto the canvas.
  const iconDrag =
    a.type === 'icon' || a.type === 'tech-icon'
      ? (e: React.DragEvent) => {
          e.dataTransfer.setData(a.type === 'icon' ? ICON_DND_MIME : TECH_ICON_DND_MIME, a.iconId);
          e.dataTransfer.effectAllowed = 'copy';
        }
      : undefined;
  // Sticky tiles drag too (the plain note + the Event Storming notation,
  // spec/139), carrying their kind so the drop routes + sizes like a tap.
  // The IconButton clears the ghost on dragEnd for every tile, so setting
  // it here is safe.
  const stickyDrag =
    a.type === 'sticky'
      ? (e: React.DragEvent) => {
          e.dataTransfer.setData(PALETTE_DND_MIME, a.esKind ? `sticky|${a.esKind}` : 'sticky');
          e.dataTransfer.effectAllowed = 'copy';
          const size = a.esKind ? eventStormingNoteSize(a.esKind) : { width: 200, height: 200 };
          setPaletteDragPreview({
            kind: 'square',
            ...size,
            note: true,
          });
          suppressNativeDragImage(e);
        }
      : undefined;
  return (
    <IconButton
      label={def.label}
      caption={def.caption}
      description={def.description}
      onClick={onClick}
      // A drag that lands on the canvas is a use too; one dropped nowhere is
      // not.
      onDragEnd={
        recent
          ? (e) => {
              if (e.dataTransfer.dropEffect !== 'none') recent.onUse(def.id);
            }
          : undefined
      }
      dragKind={a.type === 'shape' ? a.kind : undefined}
      dragChoice={
        a.type === 'shape' ? (a.session ?? a.reaction ?? a.mode ?? a.estimateScale) : undefined
      }
      draggable={iconDrag !== undefined || stickyDrag !== undefined || undefined}
      onDragStart={iconDrag ?? stickyDrag}
      filled={def.filled}
      noTint={def.noTint}
      active={tileActive(def, pendingDraw)}
      shortcut={def.shortcut}
      hideCaption={compact}
      shortcutAlwaysVisible={compact}
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
    //
    // py-px is load-bearing: `overflow-x: hidden` cannot exist alone — the
    // spec makes the other axis compute to `auto`, so this box clips
    // VERTICALLY too, flush against the first row. That took a pixel off the
    // top border of every tile in row one (and the bottom of the last row).
    // One pixel of vertical padding gives the border somewhere to live
    // without changing how the columns pack.
    //
    // Fixed 76px columns spread edge to edge, not `grid-cols-3`. Three equal
    // fractions of the palette's body are 76.67px each, which put every tile,
    // and so every glyph, on a half pixel: a 1.5px stroke straddling a pixel
    // boundary anti-aliases to a smear. 76 is even, so the 18px glyph centred
    // in it lands on a whole pixel too; `justify-between` hands the leftover
    // width to the two gaps, which are whole pixels in every host this grid
    // renders in (the palette body, the dock popover, the strip's More).
    <div className="grid grid-cols-[repeat(3,76px)] justify-between gap-y-1 overflow-x-hidden py-px">
      {defs.map((def) => (
        <PaletteTile key={def.id} def={def} actions={actions} pendingDraw={pendingDraw} />
      ))}
    </div>
  );
}
