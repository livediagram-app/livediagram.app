// How Tab Style names a tab's New Page Background (docs/specs/011-theme/canvas-and-theme-dialog.md "New Page
// Background"): the Fine-tune row's value and the panel's choice. Pure.
import type { PageBackground, PageFill } from '@livedocuments/document';
import {
  gradientFill,
  PAGE_GRADIENT_PRESETS,
  PAGE_PATTERN_LABEL,
  sameFill,
  type ThemeBackgroundPreset,
} from '@/lib/page-paint';

/** What a fill is called: a theme gradient or a preset by its name, else what kind of fill it is. */
function fillLabel(
  fill: PageFill | undefined,
  themePresets: readonly ThemeBackgroundPreset[],
): string {
  if (!fill) return 'Paper';
  const theme = themePresets.find((p) => sameFill(p.fill, fill));
  if (theme) return theme.label;
  const preset = PAGE_GRADIENT_PRESETS.find((p) => sameFill(gradientFill(p), fill));
  if (preset) return preset.label;
  if (fill.kind === 'solid') return 'Solid colour';
  if (fill.kind === 'gradient') return fill.motion ? 'Animated' : 'Custom gradient';
  return 'Picture';
}

/** The row's value: "Like the page before" without one, else its fill and pattern ("Theme mist, dots"). */
export function newPageBackgroundLabel(
  background: PageBackground | undefined,
  themePresets: readonly ThemeBackgroundPreset[],
): string {
  if (!background) return 'Like the page before';
  const fill = fillLabel(background.fill, themePresets);
  return background.pattern
    ? `${fill}, ${PAGE_PATTERN_LABEL[background.pattern].toLowerCase()}`
    : fill;
}
