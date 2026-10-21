// Wordmark type in an export (docs/specs/007-editor/logo-pages.md "Wordmark type"): a text
// element's tracking, weight and case, flat or along its arc, written into the same SVG the PNG and
// PDF exports rasterise (boxedNeedsSvgRaster), so every format matches the canvas.
import type { TextElement } from './element-types';
import { PADDING_PX } from './index';
import { defaultPadding } from './colors';
import {
  svgFontFamilyAttr,
  svgRichWrappedLabel,
  svgWrappedLabel,
  type ExportLabel,
  type WordmarkAttrs,
} from './svg-render-labels';
import { labelMeasure, r2, wrapLabel, xmlEscape } from './svg-render-primitives';
import { arcGeometry, arcText, resolvedFontWeight, wordmarkDisplayText } from './wordmark';

/** A width measure that counts tracking: each glyph is followed by `letterSpacing` em. */
export function trackedMeasure(
  measure: (s: string) => number,
  letterSpacing: number | undefined,
  size: number,
): (s: string) => number {
  if (!letterSpacing) return measure;
  return (s) => measure(s) + letterSpacing * size * [...s].length;
}

/** The label of a text element carrying wordmark type, as SVG. */
export function svgWordmarkLabel(el: TextElement, label: ExportLabel): string {
  const attrs: WordmarkAttrs = {
    letterSpacing: el.letterSpacing,
    weight: el.fontWeight,
    basePx: label.size,
  };
  if (el.textArc) return svgArcLabel(el, label);
  if (label.runs) {
    const runs = label.runs.map((r) => ({ ...r, text: wordmarkDisplayText(r.text, el.textCase) }));
    return svgRichWrappedLabel(
      runs,
      label.x,
      label.y,
      label.anchor,
      label.maxWidth,
      label.valign,
      label.fontFamily,
      attrs,
    );
  }
  const text = wordmarkDisplayText(label.text, el.textCase);
  const measure = trackedMeasure(
    labelMeasure(label.size, resolvedFontWeight(el) >= 600, label.italic, label.fontFamily),
    el.letterSpacing,
    label.size,
  );
  return svgWrappedLabel(
    wrapLabel(text, label.maxWidth, measure, true),
    label.x,
    label.y,
    label.anchor,
    label.color,
    label.size,
    label.bold,
    label.italic,
    label.valign,
    label.fontFamily,
    attrs,
  );
}

// Underline and strikethrough, as the canvas draws them on arched text.
function decoration(el: TextElement): string {
  const parts = [el.textUnderline ? 'underline' : '', el.textStrikethrough ? 'line-through' : '']
    .filter(Boolean)
    .join(' ');
  return parts ? ` text-decoration="${parts}"` : '';
}

// Arched text: one line, centred on the arc's midpoint, along a path drawn in the element's box.
function svgArcLabel(el: TextElement, label: ExportLabel): string {
  const pad = PADDING_PX[el.padding ?? defaultPadding(el)];
  const { d } = arcGeometry(
    { width: el.width, height: el.height, padding: pad },
    el.textArc!,
    label.size,
  );
  const id = xmlEscape(`lvd-arc-${el.id}`);
  const text = wordmarkDisplayText(arcText(label.text), el.textCase);
  const spacing = el.letterSpacing ? ` letter-spacing="${r2(el.letterSpacing * label.size)}"` : '';
  return (
    `<g transform="translate(${r2(el.x)} ${r2(el.y)})">` +
    `<defs><path id="${id}" d="${d}" fill="none"/></defs>` +
    `<text${svgFontFamilyAttr(label.fontFamily)} font-size="${label.size}"` +
    ` font-weight="${resolvedFontWeight(el)}"${label.italic ? ' font-style="italic"' : ''}` +
    `${decoration(el)}${spacing} fill="${xmlEscape(label.color)}">` +
    `<textPath href="#${id}" startOffset="50%" text-anchor="middle">${xmlEscape(text)}</textPath>` +
    `</text></g>`
  );
}
