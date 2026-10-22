import { requestPaletteCategory } from '@/lib/palette-category-request';
import type { ComponentKind, ShapeKind } from '@livedesign/document';
import type { EmbedProvider } from '@livedesign/document';
import type { AddShapeOptions, PendingDraw } from '@/lib/draw-mode';
import { tileCaption } from './tile-caption';
import { IconButton } from '@/components/palette/palette-controls';
import type { PaletteTileDef } from './palette-tile-defs';
import { tileDragStart } from './palette-tile-drag';
import type { WhiteboardPenId } from '@/lib/whiteboard-prefs';
import { MarkerPaletteTile } from './MarkerPaletteTile';

// Renders palette tiles from the shared catalogue (palette-tile-defs): maps each tile's action
// descriptor to the editor's add-handler bundle and derives the pending-draw highlight, so every
// category body and the Toolbar strip share one tile implementation.

// The editor add-handlers a tile can invoke, bundled once in usePaletteCatalogue
// (with the mobile-close / draw-armed wrapping already applied) and threaded
// to every grid.
export type PaletteTileActions = {
  addShape: (kind: ShapeKind, opts?: AddShapeOptions) => void;
  addText: () => void;
  beginFreehand: () => void;
  beginHighlighter: () => void;
  beginShapePen: () => void;
  beginPolygon: () => void;
  beginPath: () => void;
  addArrow: (ends?: import('@livedesign/document').ArrowEnds) => void;
  addSticky: () => void;
  addTable: () => void;
  addImage: () => void;
  addAnnotation: () => void;
  addLinkCard: () => void;
  addVideo: (provider?: EmbedProvider) => void;
  addSticker: (stickerId: string) => void;
  addComponent: (kind: ComponentKind) => void;
  // Dynamic icon tiles (palette-dynamic-tiles, the Toolbar strip): drop a single line-art /
  // Technology catalogue icon, same handlers the Icons / Technology tabs use.
  addIcon: (iconId: string) => void;
  addTechIcon: (iconId: string) => void;
  // Picks up one of the markers (a logo page's Draw, the Toolbar strip's Search, palette-marker-tiles).
  beginMarker: (penId: WhiteboardPenId, once?: boolean) => void;
  // Puts the armed tool down (its tile pressed again).
  cancelDraw?: () => void;
  // Whether image uploads are available (the editor supplied onAddImage);
  // gates the `needsImage` tiles exactly as the Tools / Components tabs
  // always have.
  hasImage: boolean;
};

// A tile pressed: places or arms its tool; pressed again while armed (`pendingDraw`), puts it down
// (docs/specs/008-canvas/canvas-and-palette.md "Placement on add"). A marker keeps its press, which opens its settings.
export function tileHandler(
  def: PaletteTileDef,
  actions: PaletteTileActions,
  pendingDraw?: PendingDraw | null,
): () => void {
  const a = def.action;
  if (a.type !== 'marker' && actions.cancelDraw && tileActive(def, pendingDraw)) {
    return actions.cancelDraw;
  }
  switch (a.type) {
    case 'shape':
      // The creation-time choice rides along, so a Funnel tile places a funnel rather than a pyramid.
      return () =>
        actions.addShape(a.kind, {
          variant: a.variant,
          name: tileCaption(def.label, def.caption),
        });
    case 'text':
      return actions.addText;
    case 'freehand':
      return actions.beginFreehand;
    case 'highlighter':
      return actions.beginHighlighter;
    case 'shape-pen':
      return actions.beginShapePen;
    case 'polygon':
      return actions.beginPolygon;
    case 'path':
      return actions.beginPath;
    case 'arrow':
      // The Arrow tile's pointer, or the Line tile's none (canvas-and-palette.md "Arrows and lines").
      return () => actions.addArrow(a.ends);
    case 'sticky':
      return () => actions.addSticky();
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
    case 'marker':
      return () => (a.once ? actions.beginMarker(a.penId, true) : actions.beginMarker(a.penId));
    case 'open':
      // Off the strip (which opens its popover itself) an opener moves the palette to its category.
      return () => requestPaletteCategory(a.category);
  }
}

// Whether this tile is the armed draw-to-size intent (the pressed
// highlight). Only the annotation drops immediately and never arms, so it is
// the only kind with no active state (docs/specs/008-canvas/canvas-and-palette.md "Placement on add").
export function tileActive(
  def: PaletteTileDef,
  pendingDraw: PendingDraw | null | undefined,
): boolean {
  if (!pendingDraw) return false;
  const a = def.action;
  switch (a.type) {
    case 'shape':
      // Matched on the CHOICE too, or every variant of a kind would light up
      // together while one of them was armed.
      return (
        pendingDraw.type === 'shape' &&
        pendingDraw.kind === a.kind &&
        pendingDraw.variant === a.variant
      );
    case 'component':
      return pendingDraw.type === 'component' && pendingDraw.kind === a.kind;
    // The three pens share the freehand intent, split by the variant
    // payload — each tile lights only for its own arm (docs/specs/008-canvas/two-pens.md).
    case 'freehand':
      return pendingDraw.type === 'freehand' && pendingDraw.variant === undefined;
    case 'highlighter':
      return pendingDraw.type === 'freehand' && pendingDraw.variant === 'highlighter';
    case 'shape-pen':
      return pendingDraw.type === 'freehand' && pendingDraw.variant === 'shape-pen';
    // The Media tab has a tile per service and they all arm one `video`
    // intent, so match on the provider too or picking Loom would light up
    // Vimeo alongside it (the same trap the shape branch above avoids).
    case 'video':
      return pendingDraw.type === 'video' && pendingDraw.provider === a.provider;
    case 'sticky':
      return pendingDraw.type === 'sticky';
    // Icon / sticker tiles DO arm (they ride the shape intent carrying their
    // glyph id), but their catalogues are open-ended and the picker tabs
    // render thousands of tiles, so pressed-state matching per glyph buys
    // nothing the mode banner and cursor don't already say.
    case 'annotation':
    case 'sticker':
    case 'icon':
    case 'tech-icon':
      return false;
    // A marker in hand: the whiteboard pen intent in this pen's colour and width.
    case 'marker':
      return (
        pendingDraw.type === 'freehand' &&
        pendingDraw.variant === 'whiteboard' &&
        (pendingDraw.penId !== undefined
          ? pendingDraw.penId === a.penId
          : pendingDraw.colour === a.colour && pendingDraw.width === a.width)
      );
    default:
      return pendingDraw.type === a.type;
  }
}

export function visibleTiles(defs: PaletteTileDef[], hasImage: boolean): PaletteTileDef[] {
  return defs.filter((d) => !d.needsImage || hasImage);
}

// One catalogue tile, rendered exactly as its home tab renders it. `compact` is the
// Toolbar layout's strip (docs/specs/007-editor/toolbar-layout.md): icon only, name in the hover card, and the
// shortcut letter always showing in the corner rather than only while the
// modifier is held, the way a tool bar reads.
export function PaletteTile({
  def,
  actions,
  pendingDraw,
  compact,
  onPress,
}: {
  def: PaletteTileDef;
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null | undefined;
  compact?: boolean;
  // A press of the tile's own (a held marker opening its flyout), else the tile's action.
  onPress?: () => void;
}) {
  // A marker held, pressed again, opens its colour and width (MarkerPaletteTile).
  if (def.action.type === 'marker' && !onPress)
    return (
      <MarkerPaletteTile def={def} actions={actions} pendingDraw={pendingDraw} compact={compact} />
    );
  return (
    <TileButton
      def={def}
      actions={actions}
      pendingDraw={pendingDraw}
      compact={compact}
      onPress={onPress}
    />
  );
}

function TileButton({
  def,
  actions,
  pendingDraw,
  compact,
  onPress,
}: {
  def: PaletteTileDef;
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null | undefined;
  compact?: boolean;
  onPress?: () => void;
}) {
  const a = def.action;
  const onClick = onPress ?? tileHandler(def, actions, pendingDraw);
  // Shape tiles drag through IconButton's dragKind (which also picks their theme tint); every other
  // placeable tile (sticky, icons, sticker) carries the shared payload from tileDragStart.
  const otherDrag = a.type === 'shape' ? undefined : tileDragStart(a);
  // Greyed out with a reason: the def's own.
  const disabledReason = def.disabled?.reason;
  return (
    <IconButton
      disabledReason={disabledReason}
      label={def.label}
      caption={def.caption}
      description={def.description}
      onClick={onClick}
      dragKind={a.type === 'shape' ? a.kind : undefined}
      dragChoice={a.type === 'shape' ? a.variant : undefined}
      draggable={otherDrag !== undefined || undefined}
      onDragStart={otherDrag}
      filled={def.filled}
      noTint={def.noTint}
      active={tileActive(def, pendingDraw)}
      shortcut={def.shortcut}
      hideCaption={compact}
      stripTile={compact}
      shortcutAlwaysVisible={compact}
      finishAction={a}
    >
      {def.icon}
    </IconButton>
  );
}

// The standard 3-column tile grid every creation category uses, for the tiles its mode's palette
// layout hands it (palette-layouts).
export function PaletteTileGrid({
  tiles,
  actions,
  pendingDraw,
}: {
  tiles: PaletteTileDef[];
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null | undefined;
}) {
  const defs = visibleTiles(tiles, actions.hasImage);
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
