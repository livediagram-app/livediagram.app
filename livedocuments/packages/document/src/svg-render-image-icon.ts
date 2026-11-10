// The two image-like bodies of the export (docs/specs/020-import-export/export-fidelity.md): a bitmap as a
// clipped <image>, and an icon element's glyph nested over its box.

import { techGlyphStrokeUnits } from '@liveworkspace/icons';
import {
  DEFAULT_ICON_SIZE,
  ICON_SIZE_PX,
  iconBandBounds,
  techIconMarkBounds,
} from '@liveworkspace/model-core/icon-size';
import { iconWeightPx } from '@liveworkspace/model-core/icon-weight';
import type { BoxedElement } from './index';
import type { ExportIconArt } from './svg-render-describe';
import { r2, xmlEscape } from './svg-render-primitives';
import { imageIsShaped, imageLayout, imageMaskPath, isImageMask } from './image-frame';

// Inline a bitmap as a clipped <image>. The data URL is embedded so the SVG
// stays self-contained when downloaded; preserveAspectRatio maps objectFit
// ('cover' → slice/crop, 'contain' → meet/letterbox) and a per-element
// clipPath rounds the corners (a 'full'-radius avatar clamps to a circle). A
// white backing rect matches the on-screen white background behind the bitmap
// so a letterboxed 'contain' image doesn't show the page colour in its margins.
export function svgImageShape(
  el: BoxedElement,
  href: string,
  objectFit: 'cover' | 'contain',
  radius: number,
): string {
  const x = r2(el.x);
  const y = r2(el.y);
  const w = r2(el.width);
  const h = r2(el.height);
  const rr = r2(Math.min(radius, el.width / 2, el.height / 2));
  // Unique, XML-id-safe clip id per element (element ids are unique per tab).
  const clipId = `lvd-img-${String(el.id).replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const image = el.type === 'image' ? el : undefined;
  // A mask cuts the box to its shape (docs/specs/009-elements/picture-crop-and-mask.md); else the rounded box.
  const mask = image && isImageMask(image.mask) ? image.mask : undefined;
  const clipShape = mask
    ? `<path d="${imageMaskPath(mask, el.width, el.height, el.x, el.y)}"/>`
    : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rr}" ry="${rr}"/>`;
  const grey = image?.greyscale === true;
  const filterId = `${clipId}-grey`;
  const defs =
    `<clipPath id="${clipId}">${clipShape}</clipPath>` +
    (grey
      ? `<filter id="${filterId}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${GREY_MATRIX}"/></filter>`
      : '');
  const filterAttr = grey ? ` filter="url(#${filterId})"` : '';
  let picture: string;
  if (image && imageIsShaped(image)) {
    // The kept part laid into the box, the whole picture around it at the same scale (imageLayout).
    const natural =
      image.naturalWidth && image.naturalHeight
        ? { width: image.naturalWidth, height: image.naturalHeight }
        : null;
    const l = imageLayout(el, natural, image.crop, objectFit);
    const pic = imageTag(
      `x="${r2(el.x + l.picture.x)}" y="${r2(el.y + l.picture.y)}" width="${r2(l.picture.width)}" height="${r2(l.picture.height)}" preserveAspectRatio="none" href="${xmlEscape(href)}"${filterAttr}`,
      el,
    );
    // A letterboxed crop keeps its own edges: the picture past the part is cut off.
    const partClip = `${clipId}-part`;
    const letterboxed = l.part.x > 0.01 || l.part.y > 0.01;
    picture = letterboxed
      ? `<clipPath id="${partClip}"><rect x="${r2(el.x + l.part.x)}" y="${r2(el.y + l.part.y)}" width="${r2(l.part.width)}" height="${r2(l.part.height)}"/></clipPath>` +
        `<g clip-path="url(#${partClip})">${pic}</g>`
      : pic;
  } else {
    const par = objectFit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet';
    picture = imageTag(
      `x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${par}" href="${xmlEscape(href)}"${filterAttr}`,
      el,
    );
  }
  return (
    defs +
    `<g clip-path="url(#${clipId})">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>` +
    picture +
    `</g>`
  );
}

// Greyscale by luminance (Rec. 709 weights), the canvas's `grayscale(1)`.
const GREY_MATRIX =
  '0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0';

// The <image>, with the picture's alt text as its <title> (docs/specs/009-elements/images.md "Alt text"): what a
// screen reader names it by, and the tooltip a viewer shows.
function imageTag(attrs: string, el: BoxedElement): string {
  const alt = el.type === 'image' && typeof el.alt === 'string' ? el.alt.trim() : '';
  return alt ? `<image ${attrs}><title>${xmlEscape(alt)}</title></image>` : `<image ${attrs}/>`;
}

// A shape==='icon' element's glyph as a nested <svg> positioned over the
// element box — nesting reproduces the editor's scaling exactly (the canvas
// renders the glyph as an absolutely-positioned svg over the element).
// Line art: viewBox 0 0 24 24 scaled into the glyph band opposite the
// caption (iconBandBounds — the same inverse-alignment bands as Technology
// marks, mirroring IconGlyph). The stroke width is divided by the glyph
// scale so it lands at ~2 rendered units — the on-canvas glyph strokes are
// non-scaling 2px. Technology marks: self-coloured tile art at its fixed
// preset size in the band (TechIconGlyph).
export function svgIconShape(el: BoxedElement, art: ExportIconArt, stroke: string): string {
  if (art.colored) {
    // A Technology mark renders at its fixed preset size (docs/specs/010-palette/technology-icons.md), centred
    // in the glyph band and clamped to the box — techIconMarkBounds is the
    // single source of that geometry (shared with the connector anchors in
    // geometry.ts), mirroring TechIconGlyph exactly. The band sits OPPOSITE
    // the caption's vertical alignment so moving the text never stacks it
    // over the mark; no label = the whole box. The glyph weight follows the
    // preset's size (techGlyphStrokeUnits), exactly as TechIconArt draws it.
    const mark = techIconMarkBounds(el);
    const preset = (el.type === 'shape' ? el.iconSize : undefined) ?? DEFAULT_ICON_SIZE;
    const strokeWidth = techGlyphStrokeUnits(ICON_SIZE_PX[preset]);
    return (
      `<svg x="${r2(mark.x)}" y="${r2(mark.y)}" width="${r2(mark.width)}" height="${r2(mark.height)}"` +
      ` viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" overflow="visible"` +
      ` stroke-width="${strokeWidth}">${art.markup}</svg>`
    );
  }
  const band = iconBandBounds(el);
  const scale = Math.min(band.width / 24, band.height / 24);
  const px = iconWeightPx(el.type === 'shape' ? el.iconWeight : undefined);
  const strokeWidth = scale > 0 ? px / scale : px;
  return (
    `<svg x="${r2(band.x)}" y="${r2(band.y)}" width="${r2(band.width)}" height="${r2(band.height)}"` +
    ` viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" overflow="visible"` +
    ` fill="none" stroke="${xmlEscape(stroke)}" stroke-width="${r2(strokeWidth)}"` +
    ` stroke-linecap="round" stroke-linejoin="round">${art.markup}</svg>`
  );
}
