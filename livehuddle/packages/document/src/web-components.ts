// The web components (docs/specs/009-elements/web-components-and-no-groups.md) livehuddle still carries: the Card and
// its Callout preset as single shape kinds, plus the Hero's caption card on an image. The Banner, Stat row, Process
// steps and Header left its element engine (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine");
// a stored one is a retired element.
//
// They used to be bundles of primitives held together by a shared groupId,
// which meant a resize was a uniform zoom of loose boxes and a stray drag
// pulled one apart. As single elements they lay themselves out, and the
// layouts below are PURE so the canvas view and the headless SVG renderer
// call the same maths: an export matches the editor.
//
// A leaf module (types only from './index') like data-shapes.ts, so the
// validator and the shape factory can read its constants at module-init time
// without walking the index cycle.

import { clamp, type Rect } from '@liveworkspace/model-core/geometry-primitives';
import type { Element, ShapeKind } from './index';
import { CARD_TAGS_MAX, clampCardTag } from './card';
import { CONCEPT_ROWS, boundConceptRows, isConceptShape, type ConceptRow } from './concept';
import { withKeyMeaning } from './diagram-key';

// --- Vocabulary -------------------------------------------------------------

export type WebComponentShape = 'callout' | 'card';

// White: the text on a card's header band and a callout's badge when it carries no colour of its own.
export const ACCENT_BAR_TEXT = '#ffffff';

export function isWebComponentShape(kind: ShapeKind): kind is WebComponentShape {
  return kind === 'callout' || kind === 'card';
}

// --- Rows -------------------------------------------------------------------

// The Hero's caption card (docs/specs/009-elements/web-components-and-no-groups.md): on an ImageElement, present = shown.
export type HeroCaption = { title: string; subtitle: string };
export const HERO_DEFAULT_CAPTION: HeroCaption = {
  title: 'Hero title',
  subtitle: 'A short supporting line of text over the image.',
};

// --- Layout -----------------------------------------------------------------

export type LayoutRect = Rect;

// The hero's caption card: inset near the bottom, so the image above and
// around it stays reachable (double-click to set / change it).
export function heroCaptionLayout(
  width: number,
  height: number,
): {
  card: LayoutRect;
  title: LayoutRect;
  subtitle: LayoutRect;
  titlePx: number;
  subtitlePx: number;
} {
  const margin = Math.round(clamp(Math.min(width, height) * 0.06, 6, 28));
  const titlePx = Math.round(clamp(height * 0.075, 12, 34));
  const subtitlePx = Math.round(clamp(titlePx * 0.55, 10, 18));
  const padY = Math.round(titlePx * 0.6);
  const cardH = Math.min(height - margin * 2, padY * 2 + titlePx * 1.35 + subtitlePx * 1.5);
  const card = {
    x: margin,
    y: height - margin - cardH,
    width: Math.max(0, width - margin * 2),
    height: Math.max(0, cardH),
  };
  const padX = Math.round(titlePx * 0.7);
  const title = {
    x: card.x + padX,
    y: card.y + padY,
    width: Math.max(0, card.width - padX * 2),
    height: titlePx * 1.35,
  };
  const subtitle = {
    x: title.x,
    y: title.y + title.height,
    width: title.width,
    height: subtitlePx * 1.5,
  };
  return { card, title, subtitle, titlePx, subtitlePx };
}

// --- Writes -----------------------------------------------------------------

// The rows a web component carries, as one patch. Each field only lands on
// its own kind, so a selection-wide write over a card and a square only
// touches what each one has.
export type WebRows = {
  // A card's tag chips (docs/specs/009-elements/card.md).
  tags?: string[];
  // A Timeline's milestones (docs/specs/009-elements/timeline.md).
  conceptRows?: ConceptRow[];
  // One diagram key row's meaning (docs/specs/009-elements/diagram-key.md).
  keyMeaning?: { rowId: string; text: string };
};

// The kind each single-kind row field lands on; concept rows land on a Timeline.
const ROW_KIND: Record<Exclude<keyof WebRows, 'conceptRows' | 'keyMeaning'>, ShapeKind> = {
  tags: 'card',
};

// Apply `rows` to a shape, bounded the way validate.ts bounds them: each
// string clamped, the count held under the kind's maximum.
// Returns the element unchanged when none of the fields fit its kind.
export function withWebRows<T extends { shape: ShapeKind }>(el: T, rows: WebRows): T {
  const patch: WebRows = {};
  if (rows.tags && el.shape === ROW_KIND.tags) {
    // No tags is a card with no tag row, stored as nothing.
    const next = rows.tags.slice(0, CARD_TAGS_MAX).map(clampCardTag);
    if (next.length === 0) {
      const { tags: _gone, ...rest } = el as T & { tags?: string[] };
      return rest as T;
    }
    patch.tags = next;
  }
  if (rows.keyMeaning && el.shape === 'diagram-key') {
    return withKeyMeaning(
      el as unknown as Element,
      rows.keyMeaning.rowId,
      rows.keyMeaning.text,
    ) as unknown as T;
  }
  if (rows.conceptRows && isConceptShape(el.shape)) {
    const next = boundConceptRows(el.shape, rows.conceptRows);
    if (next) patch.conceptRows = next;
  }
  return Object.keys(patch).length > 0 ? { ...el, ...patch } : el;
}

// The next row to append, and whether there is room for it. Used by both the
// canvas "+" and the menu's Add button, so they add the same thing.
export function appendWebRow<T extends { shape: ShapeKind } & WebRows>(el: T): T {
  if (!canAppendWebRow(el)) return el;
  if (el.shape === 'card') return withWebRows(el, { tags: [...(el.tags ?? []), 'Tag'] });
  if (isConceptShape(el.shape)) {
    const rows = (el as { conceptRows?: ConceptRow[] }).conceptRows ?? [];
    const label = `${CONCEPT_ROWS[el.shape].noun} ${rows.length + 1}`;
    // Appending is the one write that may start below the minimum, one row at a time.
    return { ...el, conceptRows: [...rows, { label }] };
  }
  return el;
}

export function canAppendWebRow(el: { shape: ShapeKind } & WebRows): boolean {
  if (el.shape === 'card') return (el.tags?.length ?? 0) < CARD_TAGS_MAX;
  if (isConceptShape(el.shape))
    return (
      ((el as { conceptRows?: ConceptRow[] }).conceptRows?.length ?? 0) < CONCEPT_ROWS[el.shape].max
    );
  return false;
}
