// One `key=value` or flag after a line's label (docs/specs/024-agents/blueprints/document-views.md
// "Attributes"). `value` is the uncut value the JSON form carries; `text` is what the line prints.
export type ViewAttribute = { key: string; value: string | null; text: string };

export function flagAttribute(key: string): ViewAttribute {
  return { key, value: null, text: key };
}

// A value the view composes itself (a count, a state word), printed bare.
export function countAttribute(key: string, value: string | number): ViewAttribute {
  return { key, value: String(value), text: `${key}=${value}` };
}

export function shapeKindOf(el: { type: string }): string {
  const shape = Reflect.get(el, 'shape');
  return el.type === 'shape' && typeof shape === 'string' ? shape : el.type;
}
