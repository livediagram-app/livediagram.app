// What the Overview wears (docs/specs/026-plan/plan-overview.md "Style"): its own style, else its plan's first tab's.
// Type-only imports, so the editor reads it (the accent) without loading the Overview.
import type { OverviewStyle } from '@liveplanner/api-schema';
import type { Tab } from '@liveplanner/project';

// The settings the Overview wears, in the order a tab holds them.
const STYLE_KEYS = [
  'theme',
  'backgroundPattern',
  'backgroundColor',
  'patternColor',
  'backgroundOpacity',
  'backgroundPatternScale',
  'backgroundAnimationSpeed',
  'font',
  'defaultTextSize',
] as const satisfies readonly (keyof OverviewStyle)[];

export function pickStyle(source: Partial<Tab> | OverviewStyle): OverviewStyle {
  const style: Record<string, unknown> = {};
  for (const key of STYLE_KEYS) if (source[key] !== undefined) style[key] = source[key];
  return style;
}

// What the Overview wears: its own style, or (none set) its first tab's.
export function overviewLookOf(
  style: OverviewStyle | null,
  firstTab: Partial<Tab> | undefined,
): OverviewStyle {
  return style ?? (firstTab ? pickStyle(firstTab) : {});
}
