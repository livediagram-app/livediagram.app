import { useAppearance } from '@livedesign/ui';
import { startPalette, type StartPalette } from './start-palette';

// The start panel's colours and the tours' (start-palette.ts): the app's own light or dark look, never the tab's
// theme (owner, 2026-11-10), so every app's start keeps its own header theme whatever the tab wears. Light or dark
// follows Appearance, not the tab's paper.
export function useStartPalette(): StartPalette {
  const { appearance } = useAppearance();
  return startPalette(appearance, {});
}
