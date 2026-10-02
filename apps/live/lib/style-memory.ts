// Style memory (docs/specs/008-canvas/quick-style-panel.md "Style memory"): per element kind, the last
// value chosen for each quick-style field, so the next shape of that kind the
// user draws arrives dressed the same way. Pure; the hook (useStyleMemory)
// owns the state and the storage.
import {
  SHAPE_KINDS,
  BORDER_RADIUS_PX,
  isPenColourName,
  isQuickSwatchSlot,
  rederiveColorPresetForTheme,
  rederiveQuickSwatches,
  type Element,
  type ThemeDefinition,
} from '@livediagram/document';
import { safeJson } from './local-storage-safe';
import { isQuickStyleTarget } from './quick-style';

// `shape:<ShapeKind>` for a shape, `arrow` for every arrow, `text` for every
// text element; `board:` before any of them on a whiteboard, which keeps a memory
// of its own (docs/specs/023-draw-mode/draw-mode.md "The quick style panel stays").
type BaseKindKey = `shape:${string}` | 'arrow' | 'text' | 'path';
export type StyleKindKey = BaseKindKey | `board:${BaseKindKey}`;
const BOARD_PREFIX = 'board:';
const baseOf = (kind: string): string =>
  kind.startsWith(BOARD_PREFIX) ? kind.slice(BOARD_PREFIX.length) : kind;
export type RememberedStyle = Record<string, string | number>;
export type StyleMemory = Partial<Record<StyleKindKey, RememberedStyle>>;

// The fields memory records and applies. The label colour and a preset's
// binding ride with the colours, so a remembered background never lands under
// unreadable text and a remembered preset look follows the theme.
// `penColour` / `penTextColour`: a whiteboard stock colour stored by name (docs/specs/023-draw-mode/
// draw-mode.md "The quick style panel stays"), checked against the names when read.
const SHAPE_MEMORY_FIELDS = {
  strokeColor: 'string',
  penColour: 'string',
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
  penColour: 'string',
  strokeSwatch: 'number',
  strokeWidth: 'number',
  strokeStyle: 'string',
  flow: 'string',
} as const;
// A path (docs/specs/023-draw-mode/path-tool.md "Style"): its line and its fill.
const PATH_MEMORY_FIELDS = {
  strokeColor: 'string',
  penColour: 'string',
  strokeSwatch: 'number',
  fillColor: 'string',
  fillSwatch: 'number',
  strokeWidth: 'string',
  strokeStyle: 'string',
} as const;
const TEXT_MEMORY_FIELDS = {
  textColor: 'string',
  penTextColour: 'string',
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

export function styleKindOf(el: Element, board = false): StyleKindKey | null {
  const base: BaseKindKey | null =
    el.type === 'arrow'
      ? 'arrow'
      : el.type === 'text'
        ? 'text'
        : el.type === 'path'
          ? 'path'
          : el.type === 'shape'
            ? `shape:${el.shape}`
            : null;
  return base && board ? `${BOARD_PREFIX}${base}` : base;
}

// A board's shapes also remember their corners (the Corners row, whiteboards only:
// docs/specs/008-canvas/quick-style-panel.md "Corners"); a diagram's do not.
const BOARD_SHAPE_MEMORY_FIELDS = { ...SHAPE_MEMORY_FIELDS, borderRadius: 'string' } as const;

function fieldsFor(scoped: StyleKindKey): FieldTypes {
  const kind = baseOf(scoped);
  if (scoped.startsWith(BOARD_PREFIX) && kind.startsWith('shape:'))
    return BOARD_SHAPE_MEMORY_FIELDS;
  if (kind === 'arrow') return ARROW_MEMORY_FIELDS;
  if (kind === 'path') return PATH_MEMORY_FIELDS;
  return kind === 'text' ? TEXT_MEMORY_FIELDS : SHAPE_MEMORY_FIELDS;
}

function isKnownKind(scoped: string): scoped is StyleKindKey {
  const key = baseOf(scoped);
  if (key === 'arrow' || key === 'text' || key === 'path') return true;
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
  board = false,
): StyleMemory {
  const previous = new Map(before.map((el) => [el.id, el]));
  let next: StyleMemory | null = null;
  for (const el of after) {
    const was = previous.get(el.id);
    if (!was || !isQuickStyleTarget(el)) continue;
    const kind = styleKindOf(el, board)!;
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
  board = false,
): T {
  const kind = styleKindOf(el, board);
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
      if (field.startsWith('pen') && !isPenColourName(value)) continue;
      if (field === 'borderRadius' && !(typeof value === 'string' && value in BORDER_RADIUS_PX))
        continue;
      entry[field] = value as string | number;
    }
    if (Object.keys(entry).length > 0) out[kind] = entry;
  }
  return out;
}
