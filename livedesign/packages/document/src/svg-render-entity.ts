// An entity's body in the SVG export (docs/specs/009-elements/entity.md "How it looks"): the tinted title
// band and its rule, the striped field rows, the key gutter and its glyphs, names and types. The TITLE is
// the element's ordinary label, so the generic label emitter still draws it, over the band.
//
// The same geometry the canvas draws (entity-geometry.ts, entity-look.ts), so a PNG matches the board.

import type { EntityField } from './data-shapes';
import { entityFieldView, entityKeyGutterPx } from './entity-fields';
import {
  ENTITY_BODY_PAD_PX,
  ENTITY_KEY_GLYPH_INSET_PX,
  ENTITY_ROW_GAP_PX,
  ENTITY_ROW_TEXT_PX,
  ENTITY_SIDE_PAD_PX,
  entityHeaderHeight,
} from './entity-geometry';
import {
  ENTITY_KEY_GLYPH_PATHS,
  ENTITY_KEY_GLYPH_PX,
  ENTITY_KEY_GLYPH_STEP_PX,
  ENTITY_KEY_GLYPH_STROKE,
  ENTITY_PRIMARY_KEY_INK,
  entityKeyGlyphs,
  ENTITY_BAND_TINT,
  ENTITY_MONO_FONT,
  ENTITY_STRIPE_TINT,
  ENTITY_TYPE_OPACITY,
} from './entity-look';
import type { Finish } from './finish';
import type { BoxedElement } from './index';
import { borderOf } from './svg-render-border';
import { r2, xmlEscape } from './svg-render-primitives';

type Entity = BoxedElement & { type: 'shape' };

// The muted rule under the title when the entity has no border colour of its own (Tailwind slate-300).
const MUTED_RULE = '#cbd5e1';

const sans = (fontFamily?: string) =>
  ` font-family="${xmlEscape(fontFamily ?? 'system-ui, sans-serif')}"`;

function glyphs(field: EntityField, x: number, midY: number, ink: string): string {
  const key = field.key;
  if (!key) return '';
  const colour = key === 'pk' || key === 'pk-fk' ? ENTITY_PRIMARY_KEY_INK : ink;
  return entityKeyGlyphs(key)
    .map((g, i) => {
      // The link glyph after a key takes the row's ink: the pair reads as two marks, not one blob.
      const stroke = g === 'key' ? colour : ink;
      const opacity = g === 'key' ? '' : ' opacity="0.7"';
      const left = x + i * ENTITY_KEY_GLYPH_STEP_PX;
      const top = midY - ENTITY_KEY_GLYPH_PX / 2;
      return (
        `<path d="${ENTITY_KEY_GLYPH_PATHS[g]}" transform="translate(${r2(left)} ${r2(top)})" fill="none"` +
        ` stroke="${xmlEscape(stroke)}" stroke-width="${ENTITY_KEY_GLYPH_STROKE}" stroke-linecap="round"` +
        ` stroke-linejoin="round"${opacity}/>`
      );
    })
    .join('');
}

export function svgEntityRows(
  el: Entity,
  o: { textColor: string; stroke: string; fontFamily?: string; finish?: Finish },
): string {
  const { textColor, fontFamily } = o;
  const headerH = entityHeaderHeight(el.textSize);
  const fields = (el.entityFields ?? []).map(entityFieldView);

  // Everything is clipped to the inside of the border, so the band and the stripes take its corners.
  const b = borderOf(el, o.finish);
  const w = Math.max(0, el.width - b.width * 2);
  const h = Math.max(0, el.height - b.width * 2);
  const rx = Math.max(0, Math.min(b.radius - b.width, Math.min(w, h) / 2));
  const clipId = `lvd-en-${el.id.replace(/[^A-Za-z0-9_-]/g, '')}`;
  const clip =
    `<clipPath id="${clipId}"><rect x="${r2(el.x + b.width)}" y="${r2(el.y + b.width)}"` +
    ` width="${r2(w)}" height="${r2(h)}" rx="${r2(rx)}"/></clipPath>`;

  const bandFill = el.headerFill ?? o.stroke;
  const band =
    `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(headerH)}"` +
    ` fill="${xmlEscape(bandFill)}"${el.headerFill ? '' : ` opacity="${ENTITY_BAND_TINT}"`}/>`;
  const rule =
    `<path d="M ${r2(el.x)} ${r2(el.y + headerH)} L ${r2(el.x + el.width)} ${r2(el.y + headerH)}"` +
    ` stroke="${xmlEscape(el.strokeColor ?? MUTED_RULE)}" stroke-width="1"/>`;

  const pitch = ENTITY_ROW_TEXT_PX + ENTITY_ROW_GAP_PX;
  const top = el.y + headerH + ENTITY_BODY_PAD_PX;
  const gutter = entityKeyGutterPx(fields);
  const ink = xmlEscape(textColor);
  let stripes = '';
  let rows = '';
  fields.forEach((f, i) => {
    const rowTop = top + i * pitch;
    if (rowTop + ENTITY_ROW_TEXT_PX > el.y + el.height + 0.5) return;
    const mid = rowTop + ENTITY_ROW_TEXT_PX / 2;
    // Every other row on a faint stripe, the band spanning the gap on either side so stripes tile.
    if (i % 2 === 1) {
      stripes +=
        `<rect x="${r2(el.x)}" y="${r2(rowTop - ENTITY_ROW_GAP_PX / 2)}" width="${r2(el.width)}"` +
        ` height="${r2(pitch)}" fill="${ink}" opacity="${ENTITY_STRIPE_TINT}"/>`;
    }
    const baseline = mid + 3.5;
    const weight = f.key === 'pk' || f.key === 'pk-fk' ? ' font-weight="600"' : '';
    rows += glyphs(f, el.x + ENTITY_KEY_GLYPH_INSET_PX, mid, textColor);
    rows +=
      `<text x="${r2(el.x + ENTITY_SIDE_PAD_PX + gutter)}" y="${r2(baseline)}"${sans(fontFamily)}` +
      ` font-size="11"${weight} fill="${ink}">${xmlEscape(f.name)}</text>`;
    // The type is muted, monospace and pushed right: scanning a class is scanning the NAMES.
    if (f.type) {
      rows +=
        `<text x="${r2(el.x + el.width - ENTITY_SIDE_PAD_PX)}" y="${r2(baseline)}" text-anchor="end"` +
        ` font-family="${ENTITY_MONO_FONT}" font-size="10" opacity="${ENTITY_TYPE_OPACITY}"` +
        ` fill="${ink}">${xmlEscape(f.type)}</text>`;
    }
  });
  return `${clip}<g clip-path="url(#${clipId})">${band}${stripes}</g>${rule}${rows}`;
}
