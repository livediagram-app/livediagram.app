import { CANVAS_CONTROLS } from './event-vocab';
import type { TypeAliases } from './rank';

// How the dashboard reads the look-and-feel events (docs/specs/017-telemetry/telemetry.md), shared by the
// Look & Feel tab's rankings and the Look & Feel stack on the Dashboard.

// Theme·Changed types that are NOT built-in theme picks, so the theme
// ranking excludes them: the custom-theme builder's applied/edited variants.
export const CUSTOM_THEME_TYPES: ReadonlySet<string> = new Set(['Custom', 'CustomEdited']);

// Theme·Changed types nothing sends any more but stored rows still carry: the one-shot "Reset elements to theme"
// recolour (`ResetElements`), removed with its button from Tab Style. Still kept out of the theme ranking, where
// it would otherwise compete as if it were a theme.
const RETIRED_THEME_TYPES: ReadonlySet<string> = new Set(['ResetElements']);

/** Whether a Theme·Changed type is not a built-in theme pick. */
export const isNonThemePick = (t: string | undefined | null): boolean =>
  CUSTOM_THEME_TYPES.has(t ?? '') || RETIRED_THEME_TYPES.has(t ?? '');

// The built-in brand theme was labelled Basic until #73 renamed it Default
// (packages/project themes-data.ts), and the token follows the label. Rows
// stored before the rename fold into Default so one theme ranks once.
export const THEME_ALIASES: TypeAliases = { Basic: 'Default' };

// Canvas·Changed types that are NOT a background pattern: the colour /
// opacity / scale / animation-speed controls in the canvas panel
// (CANVAS_CONTROLS). The Canvas Styles ranking is patterns only, so these
// stay out of it.
export const NON_PATTERN_CANVAS_TYPES: readonly string[] = Object.keys(CANVAS_CONTROLS);
