// Static-import icon resolver for headless renderers (the api worker's
// live image / thumbnail and the MCP worker's inline render). Importing
// this module pulls the FULL catalogue data (~60 kB) into the bundle —
// fine for a Worker, wrong for the editor's first load, which is why it
// is a separate subpath the index never re-exports. The editor builds the
// same resolver shape from its async icon-registry instead.

import { ICON_CATALOG_1 } from './icon-catalog-1';
import { ICON_CATALOG_2 } from './icon-catalog-2';
import { ICON_CATALOG_3 } from './icon-catalog-3';
import { iconPrimsMarkup, techIconArtMarkup, type IconExportArt } from './markup';
import { STICKER_CATALOG } from './sticker-catalog';
import {
  emojiArtMarkup,
  emojiStickerArt,
  ICON_GLYPH_BOX,
  stickerArt,
  type EmojiArt,
  type StickerArt,
} from './sticker-markup';
import { TECH_ICON_CATALOG } from './tech-icon-catalog';

const stickerById = new Map(STICKER_CATALOG.map((s) => [s.id, s]));
const techById = new Map(TECH_ICON_CATALOG.map((i) => [i.id, i]));
const lineById = new Map(
  [...ICON_CATALOG_1, ...ICON_CATALOG_2, ...ICON_CATALOG_3].map((i) => [i.id, i]),
);

// Resolve an element's `iconId` to renderable art, or undefined for an
// unknown id (the renderer then falls back to its box-with-label output).
// Tech ids win, mirroring the editor's render dispatch (isTechIconId).
export function resolveIconExportArt(iconId: string): IconExportArt | undefined {
  const tech = techById.get(iconId);
  if (tech) return { markup: techIconArtMarkup(tech), colored: true };
  const line = lineById.get(iconId);
  return line ? { markup: iconPrimsMarkup(line.prims), colored: false } : undefined;
}

// Resolve a sticker element's `stickerId` to its built artwork (docs/specs/010-palette/stickers.md), or
// undefined for an unknown id — the renderer then falls back to a plain box,
// the same way an unknown icon id does. Goes through `stickerArt`, the one
// builder the editor canvas uses too, so a shared thumbnail and the canvas
// show the same sticker.
export function resolveStickerArt(stickerId: string): StickerArt | undefined {
  const def = stickerById.get(stickerId);
  return def ? stickerArt(def) : undefined;
}

// An emoji drawn where no emoji font is (a PNG preview rasterised in a Worker, docs/specs/015-api/mcp-server.md §5)
// and its art could not be fetched: its glyph would come out as the missing-glyph boxes, so it draws as a soft disc
// that says it is an emoji.
const EMOJI_PLACEHOLDER =
  '<circle cx="12" cy="12" r="10.5" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1"/>' +
  '<text x="12" y="14.4" font-size="6.5" text-anchor="middle" fill="#64748b" stroke="none">emoji</text>';

export type { EmojiArt };

// The emoji an emoji icon draws (its one text primitive), or undefined for any other icon.
export function iconEmojiGlyph(iconId: string): string | undefined {
  const prim = lineById.get(iconId)?.prims.find((p) => p.t === 'text');
  return prim && prim.t === 'text' ? prim.text : undefined;
}

// The emoji an emoji sticker draws, or undefined for a badge or an unknown id.
export function stickerEmojiGlyph(stickerId: string): string | undefined {
  const def = stickerById.get(stickerId);
  return def?.kind === 'emoji' ? def.glyph : undefined;
}

// The file Twemoji names an emoji by: its code points in hex joined by "-", the variation selector (FE0F) dropped
// unless the emoji joins others (a ZWJ sequence keeps it), as Twemoji's own parser names them.
export function twemojiFileName(glyph: string): string {
  const points = [...glyph].map((c) => c.codePointAt(0)!.toString(16));
  return (points.includes('200d') ? points : points.filter((p) => p !== 'fe0f')).join('-');
}

// An emoji SVG's viewBox and contents, or null when it is not one SVG with a viewBox.
export function emojiArtOf(svg: string): EmojiArt | null {
  const m = /^\s*<svg\b[^>]*\bviewBox="([\d.\s-]+)"[^>]*>([\s\S]*)<\/svg>\s*$/.exec(svg);
  return m ? { viewBox: m[1]!, markup: m[2]! } : null;
}

// The preview's resolvers (a render with no emoji font): an emoji drawn from its art when `emoji` holds it (by glyph),
// else as the labelled disc; anything else as resolveIconExportArt and resolveStickerArt draw it.
export function previewResolvers(emoji: ReadonlyMap<string, EmojiArt> = new Map()): {
  resolveIconArt: (iconId: string) => IconExportArt | undefined;
  resolveStickerArt: (stickerId: string) => StickerArt | undefined;
  resolveEmojiArt: (glyph: string) => EmojiArt | undefined;
} {
  return {
    resolveEmojiArt: (glyph) => emoji.get(glyph),
    resolveIconArt: (iconId) => {
      const glyph = iconEmojiGlyph(iconId);
      if (glyph === undefined) return resolveIconExportArt(iconId);
      const art = emoji.get(glyph);
      return {
        markup: art ? emojiArtMarkup(art, ICON_GLYPH_BOX) : EMOJI_PLACEHOLDER,
        colored: true,
      };
    },
    resolveStickerArt: (stickerId) => {
      const glyph = stickerEmojiGlyph(stickerId);
      if (glyph === undefined) return resolveStickerArt(stickerId);
      const art = emoji.get(glyph);
      return art ? emojiStickerArt(art) : { viewBox: '0 0 24 24', markup: EMOJI_PLACEHOLDER };
    },
  };
}

/** resolveIconExportArt for a render with no emoji font: an emoji icon as its placeholder. */
export const resolveIconPreviewArt = previewResolvers().resolveIconArt;

/** resolveStickerArt for a render with no emoji font: an emoji sticker as its placeholder. */
export const resolveStickerPreviewArt = previewResolvers().resolveStickerArt;
