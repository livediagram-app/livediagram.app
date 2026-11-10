import { useAppearance } from '@liveplanner/ui';
import { planPalette, type PlanPalette } from '@liveplanner/project';

// The start panel's colours and the tours' (start-palette.ts): the app's own light or dark look, never the tab's
// theme (owner, 2026-11-10), so every app's start keeps its own header theme whatever the tab wears. Light or dark
// follows Appearance, not the tab's paper.
export function useStartPalette(): PlanPalette {
  const { appearance } = useAppearance();
  return planPalette(appearance, {});
}
