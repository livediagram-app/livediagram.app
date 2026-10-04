// The style keys views print and edit operations write (docs/specs/024-agents/blueprints/document-views.md
// "Style attributes"): one table, so a printed `key=value` can be written back with `set` unchanged.
export type StyleKeyTarget = 'boxes' | 'arrows' | 'both';

export type StyleKey = {
  readonly key: string;
  readonly field: string;
  readonly on: StyleKeyTarget;
};

export const STYLE_KEYS: readonly StyleKey[] = [
  { key: 'fill', field: 'fillColor', on: 'boxes' },
  { key: 'stroke', field: 'strokeColor', on: 'both' },
  { key: 'text-color', field: 'textColor', on: 'boxes' },
  { key: 'border', field: 'strokeStyle', on: 'boxes' },
  { key: 'line', field: 'arrowStyle', on: 'arrows' },
  { key: 'text', field: 'textSize', on: 'boxes' },
  { key: 'font', field: 'font', on: 'boxes' },
];

// The style keys an element of this type takes, in table order.
export function styleKeysFor(type: string): readonly StyleKey[] {
  const target = type === 'arrow' ? 'arrows' : 'boxes';
  return STYLE_KEYS.filter((k) => k.on === 'both' || k.on === target);
}
