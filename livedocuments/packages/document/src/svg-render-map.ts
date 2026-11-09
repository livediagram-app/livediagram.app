// The map in exports (docs/specs/009-elements/map.md "Exports and other surfaces"; blueprint "Layout"):
// the same `mapLayout` the canvas draws, as SVG. Countries in a group scaled from the plane, clipped
// to the element's box; pins and labels on top in px. Without provided geometry, the placeholder.

import type { ShapeElement } from './element-types';
import { mapLayout, pinLabelAnchor, type MapColours } from './map-layout';
import { providedMapGeometry, type MapGeometry } from './map-model';
import { r2, xmlEscape } from './svg-render-primitives';
import { svgFontFamilyAttr } from './svg-render-labels';

// The placeholder's opacity while no geometry is provided (D198).
export const MAP_PLACEHOLDER_OPACITY = 0.6;

export function svgMap(
  el: ShapeElement,
  colours: MapColours,
  fontFamily?: string,
  geometry: MapGeometry | null = providedMapGeometry(),
): string {
  const layout = mapLayout(el, el.width, el.height, geometry, colours);
  if (!layout) return '';
  const { x, y, width, height } = el;
  const clipId = `mapclip-${el.id.replace(/[^A-Za-z0-9_-]/g, '_')}`;
  let out =
    `<defs><clipPath id="${clipId}"><rect x="${r2(x)}" y="${r2(y)}" width="${r2(width)}" height="${r2(height)}"/></clipPath></defs>` +
    `<g clip-path="url(#${clipId})">`;
  if (!geometry) {
    out +=
      `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(width)}" height="${r2(height)}" rx="${r2(Math.min(width, height) * 0.06)}"` +
      ` fill="${xmlEscape(colours.land)}" opacity="${MAP_PLACEHOLDER_OPACITY}"/>`;
  } else {
    // The plane's units to the page: the border width is in px, so divide it back by the scale.
    out +=
      `<g transform="translate(${r2(x + layout.tx)} ${r2(y + layout.ty)}) scale(${layout.scale.toFixed(5)})"` +
      ` stroke="${xmlEscape(colours.paper)}" stroke-width="${(layout.borderWidth / layout.scale).toFixed(3)}" stroke-linejoin="round">`;
    for (const c of layout.countries) {
      out += `<path d="${c.d}" fill="${xmlEscape(c.fill)}"${c.opacity !== 1 ? ` fill-opacity="${c.opacity}"` : ''}/>`;
    }
    out += '</g>';
  }
  for (const p of layout.pins) {
    const px = x + p.x;
    const py = y + p.y;
    out +=
      `<circle cx="${r2(px)}" cy="${r2(py)}" r="${r2(layout.pinRadius)}" fill="${xmlEscape(colours.accent)}"` +
      ` stroke="${xmlEscape(colours.paper)}" stroke-width="${r2(layout.pinRing)}"/>`;
    if (!p.label) continue;
    const at = pinLabelAnchor(p, layout);
    out +=
      `<text x="${r2(x + at.x)}" y="${r2(py)}"${svgFontFamilyAttr(fontFamily)} font-size="${r2(layout.labelSize)}"` +
      ` font-weight="600" fill="${xmlEscape(colours.text)}" stroke="${xmlEscape(colours.paper)}"` +
      ` stroke-width="${r2(layout.labelHalo)}" stroke-linejoin="round" paint-order="stroke"` +
      ` text-anchor="${at.anchor}" dominant-baseline="central">${xmlEscape(p.label)}</text>`;
  }
  return `${out}</g>`;
}
