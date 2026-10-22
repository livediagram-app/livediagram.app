// What a tab added from the tab bar starts with: the theme, canvas
// styling and type of the tab it was added from, so a user mid-diagram who hits "+ tab" keeps
// their visual context. Each tab keeps its own styling once created.
import type { Tab } from '@livepages/document';

export function newTabSeed(source: Tab | undefined): Partial<Tab> {
  if (!source) return {};
  return {
    theme: source.theme,
    backgroundPattern: source.backgroundPattern,
    backgroundColor: source.backgroundColor,
    backgroundOpacity: source.backgroundOpacity,
    patternColor: source.patternColor,
    font: source.font,
    // Small (docs/specs/004-interface-design/fonts.md) when the source has no explicit size.
    defaultTextSize: source.defaultTextSize ?? 'sm',
  };
}
