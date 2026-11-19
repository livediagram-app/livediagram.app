// The typefaces the Tab Style Text panel offers (each product's 011-theme/canvas-and-theme-dialog.md "Text panel";
// docs/specs/004-interface-design/fonts.md): "Editor default" first (no tab font, the editor's own face), then the
// faces the product offers, the whole catalogue unless it narrows it (liveplanner).
import { FONTS } from '@liveworkspace/model-core/fonts';
import type { TabStyleFont } from './tab-style-profile';

export type TabStyleFontOption = {
  id: string | null;
  label: string;
  kind: string;
  stack: string | undefined;
};

const EDITOR_DEFAULT = 'Editor default';

/** The Text panel's typeface cards: Editor default, then the offered faces. */
export function tabStyleFontOptions(
  fonts: readonly TabStyleFont[] = FONTS,
): readonly TabStyleFontOption[] {
  return [
    { id: null, label: EDITOR_DEFAULT, kind: 'System', stack: undefined },
    ...fonts.map((f) => ({ id: f.id, label: f.label, kind: f.kind, stack: f.stack })),
  ];
}

/** A tab font's name, from the whole catalogue: a tab already set to a face no longer offered keeps its name. */
export function tabStyleFontLabel(font: string | null): string {
  return FONTS.find((f) => f.id === font)?.label ?? EDITOR_DEFAULT;
}
