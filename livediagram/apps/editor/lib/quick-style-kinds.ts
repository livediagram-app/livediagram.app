// The quick style panel's rows for the kinds the theme rows pass over
// (docs/specs/008-canvas/quick-style-panel.md "Sticky notes and code blocks"): a sticky note's paper, from the pad
// of note colours its menu's Presets offer, and a code block's theme, from the eight its menu offers. Neither
// follows the tab's theme, so neither takes the theme's swatches; each gets the choices that are its own.
import {
  CODE_THEMES,
  STICKY_PRESETS,
  quickSwatches,
  type CodeThemeId,
  type Element,
  type ShapeElement,
  type StickyElement,
  type TableElement,
  type ThemeDefinition,
} from '@livediagram/document';
import {
  applyCodeThemeToEl,
  applyColorPresetToEl,
  applyFillColorToEl,
  applyTextColorToEl,
} from './style-presets';
import {
  applySwatchOverrides,
  type SwatchOverrides,
} from '@liveworkspace/workbench/lib/swatch-overrides';

type Option<V extends string> = { value: V; name: string; swatch: string };

export type QuickNoteStyle = { ids: string[]; value: string | null; options: Option<string>[] };
export type QuickCodeStyle = {
  ids: string[];
  value: CodeThemeId | null;
  options: Option<CodeThemeId>[];
};

// The warm and cool halves of the pad: the eight a row holds beside More colours. The neutrals stay in the menu.
const NOTE_PRESETS = STICKY_PRESETS.slice(0, 8);
const NOTE_OPTIONS = NOTE_PRESETS.map((p) => ({ value: p.id, name: p.name, swatch: p.fill }));
const CODE_OPTIONS = CODE_THEMES.map((t) => ({ value: t.id, name: t.name, swatch: t.surface }));
// A note with no colour of its own is the pad's first sheet.
const DEFAULT_NOTE_FILL = STICKY_PRESETS[0]!.fill;

const shared = <T>(values: (T | null)[]): T | null =>
  values.length > 0 && values.every((v) => v === values[0]) ? (values[0] ?? null) : null;

const isNote = (el: Element): el is StickyElement => el.type === 'sticky' && el.locked !== true;
const isCodeBlock = (el: Element): el is ShapeElement =>
  el.type === 'shape' && el.shape === 'code-block' && el.locked !== true;

export function noteQuickStyle(selected: readonly Element[]): QuickNoteStyle | undefined {
  const notes = selected.filter(isNote);
  if (notes.length === 0) return undefined;
  const presetOf = (el: StickyElement) => {
    const fill = (el.fillColor ?? DEFAULT_NOTE_FILL).toLowerCase();
    return NOTE_PRESETS.find((p) => p.fill === fill)?.id ?? null;
  };
  return { ids: notes.map((n) => n.id), value: shared(notes.map(presetOf)), options: NOTE_OPTIONS };
}

export function codeQuickStyle(selected: readonly Element[]): QuickCodeStyle | undefined {
  const blocks = selected.filter(isCodeBlock);
  if (blocks.length === 0) return undefined;
  return {
    ids: blocks.map((b) => b.id),
    value: shared(blocks.map((b) => b.codeTheme ?? CODE_THEMES[0]!.id)),
    options: CODE_OPTIONS,
  };
}

// A table's cells and their words in the tab theme's colours: the Background and Text colour rows' own swatches
// (the theme's default first), set as plain colours, since a table keeps no swatch binding. The colour every
// selected table wears is marked; an unset or other colour marks none.
export type QuickTableStyle = {
  ids: string[];
  background: { value: string | null; options: Option<string>[] };
  text: { value: string | null; options: Option<string>[] };
};

const isTable = (el: Element): el is TableElement => el.type === 'table' && el.locked !== true;

export function tableQuickStyle(
  selected: readonly Element[],
  theme: ThemeDefinition,
  overrides: SwatchOverrides = {},
): QuickTableStyle | undefined {
  const tables = selected.filter(isTable);
  if (tables.length === 0) return undefined;
  const row = (role: 'fill' | 'text', read: (t: TableElement) => string | undefined) => {
    const options = applySwatchOverrides(quickSwatches(theme, role), overrides[role]).map((s) => ({
      value: s.color.toLowerCase(),
      name: s.name,
      swatch: s.color,
    }));
    const value = shared(tables.map((t) => read(t)?.toLowerCase() ?? null));
    return { options, value: value && options.some((o) => o.value === value) ? value : null };
  };
  return {
    ids: tables.map((t) => t.id),
    background: row('fill', (t) => t.fillColor),
    text: row('text', (t) => t.textColor),
  };
}

export const applyTableFill = (el: Element, colour: string): Element =>
  isTable(el) ? applyFillColorToEl(el, colour) : el;
export const applyTableTextColour = (el: Element, colour: string): Element =>
  isTable(el) ? applyTextColorToEl(el, colour) : el;

/** A note in one of the pad's colours: its paper and the ink that reads on it, as the menu's preset. */
export function applyNotePreset(el: Element, presetId: string): Element {
  const preset = NOTE_PRESETS.find((p) => p.id === presetId);
  return preset && isNote(el) ? applyColorPresetToEl(el, preset) : el;
}

/** A note's paper in any colour (More colours); its ink stays. */
export const applyNoteFill = (el: Element, colour: string): Element =>
  isNote(el) ? applyFillColorToEl(el, colour) : el;

export const applyCodeBlockTheme = (el: Element, id: CodeThemeId): Element =>
  isCodeBlock(el) ? applyCodeThemeToEl(el, id) : el;
