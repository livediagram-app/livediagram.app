// A start panel's colours (docs/specs/007-editor/start-diagramming.md "Look"): the tab's own, so the panel reads as
// part of the canvas it sits on. Its paper is the tab's canvas colour, its accent (the chosen category, the focus, a
// card's hover) the theme's stroke, its ink the theme's text; planPalette then derives the rest as a coloured Plan
// board's, keeping the ink readable on the paper. A theme with no colours of its own (Default) leaves the panel the
// app's light or dark look.
import type { PlanOwnColours, Tab, ThemeDefinition } from '@livedesign/document';

export function startPanelColours(
  tab: Pick<Tab, 'backgroundColor'>,
  theme: Pick<
    ThemeDefinition,
    'backgroundColor' | 'elementStroke' | 'elementText' | 'rootColor' | 'palette'
  >,
): PlanOwnColours {
  const accent = theme.elementStroke ?? theme.rootColor?.stroke ?? theme.palette?.[0]?.stroke;
  // An unthemed tab (no accent of its own) keeps the app's own look rather than a near-copy of it.
  if (!accent) return {};
  return {
    fill: tab.backgroundColor ?? theme.backgroundColor,
    stroke: accent,
    text: theme.elementText ?? theme.rootColor?.text ?? null,
  };
}
