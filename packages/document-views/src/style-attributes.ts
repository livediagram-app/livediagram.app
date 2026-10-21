// The style a view prints with `style` (docs/specs/024-agents/blueprints/document-views.md "Style
// attributes", VW50): each style key's field when present and different from what the kind's factory
// writes, keyed as edit operations write it.
import {
  createPinnedArrow,
  createShape,
  createSticky,
  createTable,
  createText,
  SHAPE_KINDS,
  styleKeysFor,
  type Element,
  type ShapeKind,
} from '@livediagram/document';
import { fieldOf } from './fields';
import { attrValue } from './text';
import { shapeKindOf, type ViewAttribute } from './view-attribute';

function isShapeKind(kind: string): kind is ShapeKind {
  return SHAPE_KINDS.has(kind);
}

function factoryOutput(el: Element): object | null {
  switch (el.type) {
    case 'shape': {
      const kind = shapeKindOf(el);
      return isShapeKind(kind) ? createShape(kind, 0, 0) : null;
    }
    case 'text':
      return createText(0, 0);
    case 'sticky':
      return createSticky(0, 0);
    case 'table':
      return createTable(0, 0);
    case 'arrow':
      return createPinnedArrow('from', 'e', 'to', 'w');
    default:
      return null;
  }
}

// Factory output per kind, built once per render.
export type StyleBaselines = (el: Element) => object | null;

export function styleBaselines(): StyleBaselines {
  const cache = new Map<string, object | null>();
  return (el) => {
    const kind = `${el.type}/${shapeKindOf(el)}`;
    if (!cache.has(kind)) cache.set(kind, factoryOutput(el));
    return cache.get(kind) ?? null;
  };
}

function printable(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

export function styleAttributesOf(el: Element, baselineOf: StyleBaselines): ViewAttribute[] {
  const baseline = baselineOf(el);
  return styleKeysFor(el.type).flatMap(({ key, field }) => {
    const value = printable(fieldOf(el, field));
    if (value === null) return [];
    if (baseline !== null && printable(fieldOf(baseline, field)) === value) return [];
    return [{ key, value, text: `${key}=${attrValue(value)}` }];
  });
}
