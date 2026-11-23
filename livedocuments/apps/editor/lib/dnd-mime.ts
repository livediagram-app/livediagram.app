// The DataTransfer types of this editor's palette drags. They carry the product's name, so a tile dragged
// from another product's editor is not read here.

// DataTransfer MIME for dragging a palette icon onto a shape. Shared by
// the palette (drag source) and BoxedElementView (drop target) so the
// type string can't drift. Value carried = the icon id.
export const ICON_DND_MIME = 'application/x-livedocuments-icon';

// Drag-from-palette MIME: a palette tile dragged onto the canvas drops a new
// element at that point. Value carried = the ShapeKind (shapes + devices).
export const PALETTE_DND_MIME = 'application/x-livedocuments-palette';

// A sticker tile dragged from the palette: its own type, so a drop on a shape cannot read it as an icon.
export const STICKER_DND_MIME = 'application/x-livedocuments-sticker';

// A technology-icon tile dragged from the palette: distinct from ICON_DND_MIME, so the tile makes a standalone icon.
export const TECH_ICON_DND_MIME = 'application/x-livedocuments-tech-icon';
