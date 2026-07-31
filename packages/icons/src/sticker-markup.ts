// The sticker's artwork, built once and shared by every renderer (spec/116):
// the editor canvas, the palette tile, the SVG / PNG / PDF export, the api
// worker's share thumbnail, and the MCP inline render. One builder rather than
// a React version and a markup version, because the whole point of a sticker
// is that it looks the same wherever it turns up.
//
// The look, in three layers: a soft shadow, the die-cut white plate, then the
// content (an emoji glyph, or a word on a coloured pill). Deliberately NO
// <filter> — an SVG filter needs a defs id, and the export packs every element
// into one document where those ids would collide. The shadow is a plain
// offset rounded rect at low opacity instead, which renders identically in
// every target including headless ones.

import { STICKER_TONE_COLOR, type StickerDef } from './sticker-types';

// Inner SVG markup plus the viewBox it is drawn in. The caller owns the <svg>
// element, so the same art serves an 18px palette tile and a 400px element.
export type StickerArt = { viewBox: string; markup: string };

const SHADOW = '#0f172a';
const SHADOW_OPACITY = 0.14;
// The hairline around the white plate. Without it a white sticker on a white
// canvas is invisible except for its shadow.
const PLATE_EDGE = '#e2e8f0';

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// A badge's word has to fit its pill, and the words run from "P0" to
// "OUT OF SCOPE". Bold uppercase at this letter-spacing measures ~0.70em per
// character, so size the text off the character count and cap it so short
// words don't balloon.
function badgeFontSize(text: string): number {
  const AVAILABLE = 168; // pill width (204) less its side padding
  return Math.min(34, Math.round((AVAILABLE / (Math.max(2, text.length) * 0.7)) * 10) / 10);
}

export function stickerArt(def: StickerDef): StickerArt {
  if (def.kind === 'badge') {
    const fill = STICKER_TONE_COLOR[def.tone];
    const text = xmlEscape(def.text.toUpperCase());
    const fs = badgeFontSize(def.text);
    return {
      viewBox: '0 0 220 88',
      markup:
        `<rect x="6" y="10" width="208" height="76" rx="26" fill="${SHADOW}" opacity="${SHADOW_OPACITY}"/>` +
        `<rect x="6" y="6" width="208" height="76" rx="26" fill="#ffffff" stroke="${PLATE_EDGE}" stroke-width="1.5"/>` +
        `<rect x="14" y="14" width="192" height="60" rx="20" fill="${fill}"/>` +
        `<text x="110" y="45" font-family="system-ui, sans-serif" font-size="${fs}"` +
        ` font-weight="800" letter-spacing="1.2" fill="#ffffff" text-anchor="middle"` +
        ` dominant-baseline="central">${text}</text>`,
    };
  }
  return {
    viewBox: '0 0 100 100',
    markup:
      `<rect x="8" y="12" width="84" height="84" rx="26" fill="${SHADOW}" opacity="${SHADOW_OPACITY}"/>` +
      `<rect x="8" y="8" width="84" height="84" rx="26" fill="#ffffff" stroke="${PLATE_EDGE}" stroke-width="1.5"/>` +
      // The emoji font supplies its own colours, so no fill is set; stroke is
      // cleared in case a non-emoji fallback character is substituted, which
      // would otherwise inherit a stroke from an ancestor group.
      `<text x="50" y="52" font-family="system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif"` +
      ` font-size="54" stroke="none" text-anchor="middle" dominant-baseline="central">${xmlEscape(def.glyph)}</text>`,
  };
}

// The whole sticker as a standalone <svg> string, for callers that paste
// markup rather than compose SVG nodes (the export renderers).
export function stickerArtMarkup(def: StickerDef, x: number, y: number, w: number, h: number) {
  const art = stickerArt(def);
  return (
    `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${art.viewBox}"` +
    ` preserveAspectRatio="xMidYMid meet" overflow="visible">${art.markup}</svg>`
  );
}
