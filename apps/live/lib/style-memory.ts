// Style memory (docs/specs/008-canvas/quick-style-panel.md "Style memory"): per element kind, the last
// value chosen for each quick-style field, so the next shape of that kind the
// user draws arrives dressed the same way. Pure; the hook (useStyleMemory)
// owns the state and the storage.
import {
  SHAPE_KINDS,
  isQuickSwatchSlot,
  rederiveColorPresetForTheme,
  rederiveQuickSwatches,
  type Element,
  type ThemeDefinition,
} from '@livediagram/document';
import { safeJson } from './local-storage-safe';
import { isQuickStyleTarget } from './quick-style';

// `shape:<ShapeKind>` for a shape, `arrow` for every arrow, `text` for every
// text element.
export type StyleKindKey = `shape:${string}` | 'arrow' | 'text';
export type RememberedStyle = Record<string, string | number>;
export type StyleMemory = Partial<Record<StyleKindKey, RememberedStyle>>;

// The fields memory records and applies. The label colour and a preset's
// binding ride with the colours, so a remembered background never lands under
// unreadable text and a remembered preset look follows the theme.
const SHAPE_MEMORY_FIELDS = {
  strokeColor: 'string',
  strokeSwatch: 'number',
  fillColor: 'string',
  fillSwatch: 'number',
  textColor: 'string',
  colorPreset: 'string',
  strokeWidth: 'string',
  strokeStyle: 'string',
  textAlignX: 'string',
  iconPosition: 'string',
} as const;
const ARROW_MEMORY_FIELDS = {
  strokeColor: 'string',
  strokeSwatch: 'number',
  strokeWidth: 'number',
  strokeStyle: 'string',
  flow: 'string',
} as const;
const TEXT_MEMORY_FIELDS = {
  textColor: 'string',
  textSwatch: 'number',
} as const;
type FieldTypes = Readonly<Record<string, 'string' | 'number'>>;

// Colour fields whose theme value is not a memory.
const THEME_VALUE_OF: Readonly<Record<string, 'elementFill' | 'elementStroke' | 'elementText'>> = {
  fillColor: 'elementFill',
  strokeColor: 'elementStroke',
  textColor: 'elementText',
};

const STORAGE_PREFIX = 'livediagram:v2:style-memory:';
export const styleMemoryKey = (documentId: string): string => `${STORAGE_PREFIX}${documentId}`;

export function styleKindOf(el: Element): StyleKindKey | null {
  if (el.type === 'arrow') return 'arrow';
  if (el.type === 'text') return 'text';
  if (el.type === 'shape') return `shape:${el.shape}`;
  return null;
}

function fieldsFor(kind: StyleKindKey): FieldTypes {
  if (kind === 'arrow') return ARROW_MEMORY_FIELDS;
  return kind === 'text' ? TEXT_MEMORY_FIELDS : SHAPE_MEMORY_FIELDS;
}

function isKnownKind(key: string): key is StyleKindKey {
  if (key === 'arrow' || key === 'text') return true;
  return key.startsWith('shape:') && SHAPE_KINDS.has(key.slice('shape:'.length));
}

function isThemeValue(field: string, value: unknown, theme: ThemeDefinition): boolean {
  const themeKey = THEME_VALUE_OF[field];
  if (!themeKey || typeof value !== 'string') return false;
  const own = theme[themeKey];
  return !!own && own.toLowerCase() === value.toLowerCase();
}

// Record what an edit changed. `before` and `after` are the same elements
// before and after one style commit; only elements present in both count.
export function recordStyleEdit(
  memory: StyleMemory,
  before: readonly Element[],
  after: readonly Element[],
  theme: ThemeDefinition,
): StyleMemory {
  const previous = new Map(before.map((el) => [el.id, el]));
  let next: StyleMemory | null = null;
  for (const el of after) {
    const was = previous.get(el.id);
    if (!was || !isQuickStyleTarget(el)) continue;
    const kind = styleKindOf(el)!;
    for (const field of Object.keys(fieldsFor(kind))) {
      const value = (el as unknown as Record<string, unknown>)[field];
      if (value === (was as unknown as Record<string, unknown>)[field]) continue;
      next ??= { ...memory };
      const entry: RememberedStyle = { ...(next[kind] ?? {}) };
      if (value === undefined || isThemeValue(field, value, theme)) delete entry[field];
      else if (typeof value === 'string' || typeof value === 'number') entry[field] = value;
      if (Object.keys(entry).length === 0) delete next[kind];
      else next[kind] = entry;
    }
  }
  return next ?? memory;
}

// Dress a freshly drawn element from memory. Swatch and preset bindings are
// re-read for the theme it is drawn under.
export function applyStyleMemory<T extends Element>(
  el: T,
  memory: StyleMemory,
  theme: ThemeDefinition,
): T {
  const kind = styleKindOf(el);
  const entry = kind ? memory[kind] : undefined;
  if (!entry) return el;
  let dressed: Element = { ...el, ...entry } as Element;
  dressed = rederiveQuickSwatches(dressed, theme);
  if (dressed.type === 'shape' && dressed.colorPreset) {
    dressed = rederiveColorPresetForTheme(dressed, theme);
  }
  return dressed as T;
}

export function forgetStyleKinds(memory: StyleMemory, kinds: readonly StyleKindKey[]): StyleMemory {
  if (!kinds.some((k) => k in memory)) return memory;
  const next = { ...memory };
  for (const k of kinds) delete next[k];
  return next;
}

// Stored memory is untrusted: keep known kinds and fields of the right type.
export function parseStyleMemory(raw: string | null): StyleMemory {
  const data = raw === null ? null : safeJson(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const out: StyleMemory = {};
  for (const [kind, fields] of Object.entries(data as Record<string, unknown>)) {
    if (!isKnownKind(kind) || !fields || typeof fields !== 'object') continue;
    const types = fieldsFor(kind);
    const entry: RememberedStyle = {};
    for (const [field, value] of Object.entries(fields as Record<string, unknown>)) {
      if (types[field] !== typeof value) continue;
      if (field.endsWith('Swatch') && !isQuickSwatchSlot(value)) continue;
      entry[field] = value as string | number;
    }
    if (Object.keys(entry).length > 0) out[kind] = entry;
  }
  return out;
}
