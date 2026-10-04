// `fill=` (docs/specs/024-agents/blueprints/edit-operations.md "Fields and values", EO21, EO49): a theme
// slot by name (`theme`, or one of the six quick-style hues, lower-cased with spaces as `-`), which
// stays bound to the theme; a hex, which overrides it and warns; on a sticky, a sticky preset name.

import {
  STICKY_PRESETS,
  quickSwatchColor,
  quickSwatches,
  type Element,
  type QuickSwatchSlot,
  type ThemeDefinition,
} from '@livediagram/document';

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export type ColourWrite =
  | { patch: Record<string, string | number | undefined>; overridesTheme: boolean }
  | { rule: string; allowed: string[] };

const slotName = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

// The theme's fill slots by the names `fill=` takes: `theme` and the six hues.
export function fillSlotNames(theme: ThemeDefinition): Map<string, 0 | QuickSwatchSlot> {
  return new Map(
    quickSwatches(theme, 'fill').map((s) => [s.slot === 0 ? 'theme' : slotName(s.name), s.slot]),
  );
}

const stickyPresetName = (id: string) => id.replace(/^sticky-/, '');

export function resolveColourValue(
  el: Element,
  value: string,
  theme: ThemeDefinition,
): ColourWrite {
  if (el.type === 'sticky') {
    const preset = STICKY_PRESETS.find((p) => stickyPresetName(p.id) === value.toLowerCase());
    if (preset)
      return { patch: { fillColor: preset.fill, textColor: preset.text }, overridesTheme: false };
    if (HEX.test(value)) return { patch: { fillColor: value }, overridesTheme: false };
    return {
      rule: 'a sticky colour or a hex',
      allowed: STICKY_PRESETS.map((p) => stickyPresetName(p.id)),
    };
  }
  const slots = fillSlotNames(theme);
  const slot = slots.get(value.toLowerCase());
  if (slot === 0)
    return {
      patch: { fillColor: quickSwatchColor(theme, 'fill', 0), fillSwatch: undefined },
      overridesTheme: false,
    };
  if (slot !== undefined) {
    // `fillSwatch` is the binding the editor re-derives on a theme change.
    return {
      patch: { fillColor: quickSwatchColor(theme, 'fill', slot), fillSwatch: slot },
      overridesTheme: false,
    };
  }
  if (HEX.test(value))
    return { patch: { fillColor: value, fillSwatch: undefined }, overridesTheme: true };
  return { rule: 'a theme colour or a hex', allowed: [...slots.keys()] };
}

export const isHexColour = (value: unknown): boolean =>
  typeof value === 'string' && HEX.test(value);

// A fill as it reads: its slot's name when bound to one, else the colour.
export function fillValue(el: Element, theme: ThemeDefinition): string | undefined {
  const slot = Reflect.get(el, 'fillSwatch');
  const swatch = quickSwatches(theme, 'fill').find((s) => s.slot !== 0 && s.slot === slot);
  if (swatch) return slotName(swatch.name);
  const colour = Reflect.get(el, 'fillColor');
  return typeof colour === 'string' ? colour : undefined;
}
