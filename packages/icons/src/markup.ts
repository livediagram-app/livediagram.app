// Pure SVG-markup builders for the two glyph kinds, mirroring the editor's
// React renderers (apps/live icon-glyph.tsx / tech-icon-glyph.tsx) so a
// headless export draws the same art the canvas shows. Data-free: safe to
// import from a first-load bundle; the catalogues themselves stay in their
// own modules (async chunk in the editor, static import in the workers via
// ./resolve).

import type { IconPrim, TechIconDef } from './types';

// The resolved art a renderer draws for one `iconId`, in a 0..24 art box.
// `colored: false` is line art — the markup carries no colours, the caller
// wraps it with the element's stroke colour + width (the editor tints
// glyphs by the element stroke). `colored: true` is a Technology brand
// mark — the markup is self-coloured (brand tile + white glyph) and must
// NOT be recoloured.
export type IconExportArt = { markup: string; colored: boolean };

function num(n: number): string {
  return String(Math.round(n * 100) / 100);
}

// One stroke primitive as markup. No per-prim styling: stroke / fill ride
// on the caller's wrapper group, exactly like the editor's <IconPrims>.
export function iconPrimMarkup(p: IconPrim): string {
  switch (p.t) {
    case 'path':
      return `<path d="${p.d}"/>`;
    case 'circle':
      return `<circle cx="${num(p.cx)}" cy="${num(p.cy)}" r="${num(p.r)}"/>`;
    case 'line':
      return `<line x1="${num(p.x1)}" y1="${num(p.y1)}" x2="${num(p.x2)}" y2="${num(p.y2)}"/>`;
    case 'rect':
      return `<rect x="${num(p.x)}" y="${num(p.y)}" width="${num(p.w)}" height="${num(p.h)}"${
        p.rx !== undefined ? ` rx="${num(p.rx)}"` : ''
      }/>`;
    case 'polyline':
      return `<polyline points="${p.points}"/>`;
    case 'polygon':
      return `<polygon points="${p.points}"/>`;
    case 'ellipse':
      return `<ellipse cx="${num(p.cx)}" cy="${num(p.cy)}" rx="${num(p.rx)}" ry="${num(p.ry)}"/>`;
  }
}

// A line-art icon's primitives, colourless (see IconExportArt).
export function iconPrimsMarkup(prims: IconPrim[]): string {
  return prims.map(iconPrimMarkup).join('');
}

// A Technology brand mark: the brand-coloured rounded tile + the white
// line-art glyph group, matching TechIconArt (tech-icon-glyph.tsx). The
// glyph markup is our own authored catalogue data, not user content.
export function techIconArtMarkup(icon: TechIconDef): string {
  return (
    `<rect x="1.5" y="1.5" width="21" height="21" rx="4.5" fill="${icon.color}"/>` +
    `<g fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icon.glyph}</g>`
  );
}
