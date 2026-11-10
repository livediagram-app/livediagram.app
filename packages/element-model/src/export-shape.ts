// What a boxed element exports as (each product's svg-render-describe.ts works it out), and the resolvers a caller
// hands the renderer for what this package never reads itself (images, icons, stickers, emoji). One copy for every
// product (liveworkspace/docs/specs/002-architecture/architecture.md "The shared element model").

// `image` carries the resolved bitmap render info: `href` is a data URL when a
// caller has supplied the bytes (the bitmap is embedded), else undefined (a
// dashed placeholder is drawn, for example a headless thumbnail with no bytes on
// hand). `objectFit` / `radius` mirror the on-screen ImageElementView so cover
// crops, contain letterboxes, and avatars clip to a circle. `none` is a
// label-only element (text); the rest carry resolved fill + stroke. `icon` is
// a shape==='icon' element whose glyph a caller resolved (see ResolveIconArt);
// it keeps fill/stroke so the isometric extrusion can tint its silhouette
// column like any other box.
export type ExportShape =
  | { kind: 'image'; href?: string; objectFit: 'cover' | 'contain'; radius: number }
  | { kind: 'ellipse'; fill: string; stroke: string }
  | { kind: 'diamond'; fill: string; stroke: string }
  | { kind: 'rect'; fill: string; stroke: string }
  | { kind: 'icon'; art: ExportIconArt; fill: string; stroke: string }
  // A sticker (docs/specs/010-palette/stickers.md): fully self-coloured art (plate, shadow, content)
  // that fills the element box. No fill / stroke, because a sticker has
  // neither: its colours are its own.
  | { kind: 'sticker'; art: ExportStickerArt }
  | { kind: 'none' };

// Resolves an image element's `imageId` to a data URL to embed, or undefined
// to fall back to the placeholder. The bytes are fetched / read by the caller
// (the browser export prefetches via the authenticated image API; a future
// worker path could read R2), keeping this renderer free of any IO.
export type ResolveImageHref = (imageId: string) => string | undefined;

// Resolved glyph art for a shape==='icon' element, in a 0..24 art box.
// `colored: false` is line art: the markup carries no colours and the
// renderer wraps it with the element's stroke colour (icons tint + theme
// like line drawings on the canvas). `colored: true` is a Technology brand
// mark: the markup is self-coloured (brand tile + white glyph) and is never
// recoloured. Matches @liveworkspace/icons' IconExportArt structurally, kept
// structural so this package doesn't depend on the catalogue package; each
// caller supplies a resolver (the editor from its async icon registry, the
// Workers from @liveworkspace/icons/resolve). No resolver, or an unknown id,
// falls back to the pre-icon output: a plain box with the centred label.
export type ExportIconArt = { markup: string; colored: boolean };
export type ResolveIconArt = (iconId: string) => ExportIconArt | undefined;

// Resolved artwork for a shape==='sticker' element (docs/specs/010-palette/stickers.md): self-coloured
// markup plus the viewBox it was drawn in. Structural, for the same reason
// ExportIconArt is: this package never imports the catalogue; each caller
// passes a resolver (the editor from its async registry, the Workers from
// @liveworkspace/icons/resolve). No resolver, or an unknown id, falls back to
// the plain box-with-label output.
export type ExportStickerArt = { viewBox: string; markup: string };
export type ResolveStickerArt = (stickerId: string) => ExportStickerArt | undefined;

// An emoji's own drawing, by its glyph, for a render with no emoji font (a Worker's preview): a face that writes an
// emoji (a reaction pad's) draws it from this instead of as text. Absent, or answering nothing, the glyph is text.
export type ResolveEmojiArt = (glyph: string) => { viewBox: string; markup: string } | undefined;
