// How Tab Style names a tab's New Page Background (docs/specs/011-theme/canvas-and-theme-dialog.md "New Page
// Background"): the shared label (@liveworkspace/page-background), naming this editor's theme gradients and presets.
import type { PageBackground } from '@liveknowledge/document';
import { newPageBackgroundLabel as sharedLabel } from '@liveworkspace/page-background/new-page-background-label';
import {
  gradientFill,
  PAGE_GRADIENT_PRESETS,
  sameFill,
  type ThemeBackgroundPreset,
} from '@/lib/page-paint';

/** The row's value: "Like the page before" without one, else its fill and pattern ("Theme Mist, dots"). */
export function newPageBackgroundLabel(
  background: PageBackground | undefined,
  themePresets: readonly ThemeBackgroundPreset[],
): string {
  return sharedLabel(
    background,
    (fill) =>
      themePresets.find((p) => sameFill(p.fill, fill))?.label ??
      PAGE_GRADIENT_PRESETS.find((p) => sameFill(gradientFill(p), fill))?.label,
  );
}
