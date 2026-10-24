import { CANVAS_CONTROLS } from './event-vocab';
import type { TypeAliases } from './rank';

// How the dashboard reads the look-and-feel events (docs/specs/017-telemetry/telemetry.md), shared by the
// Look & Feel tab's rankings and the Look & Feel stack on the Dashboard.

// Theme·Changed types that are NOT built-in theme picks, kept out of the theme ranking where they would
// otherwise compete as if they were themes. Each is sent by nothing any more but stored rows still carry them:
// the one-shot "Reset elements to theme" recolour (`ResetElements`), removed with its button from Tab Style, and
// the custom-theme builder's applied and edited picks (`Custom`, `CustomEdited`), removed with custom themes.
const RETIRED_THEME_PICKS: ReadonlySet<string> = new Set([
  'ResetElements',
  'Custom',
  'CustomEdited',
]);

/** Whether a Theme·Changed type is not a built-in theme pick. */
export type NonThemePick = (t: string | undefined | null) => boolean;

/**
 * The app's NonThemePick. `Unknown` is a theme id the editor could not name: livediagram and liveplanner no longer
 * send it (theirs report Default), so it stays out like the retired picks; livedocuments and livedesign still do,
 * so there it ranks as a pick of its own.
 */
export const nonThemePick =
  (unknownRetired: boolean): NonThemePick =>
  (t) =>
    RETIRED_THEME_PICKS.has(t ?? '') || (unknownRetired && t === 'Unknown');

// The built-in brand theme was labelled Basic until #73 renamed it Default
// (packages/document themes-data.ts), and the token follows the label. Rows
// stored before the rename fold into Default so one theme ranks once.
export const THEME_ALIASES: TypeAliases = { Basic: 'Default' };

// Canvas·Changed types that are NOT a background pattern: the colour /
// opacity / scale / animation-speed controls in the canvas panel
// (CANVAS_CONTROLS). The Canvas Styles ranking is patterns only, so these
// stay out of it.
export const NON_PATTERN_CANVAS_TYPES: readonly string[] = Object.keys(CANVAS_CONTROLS);
