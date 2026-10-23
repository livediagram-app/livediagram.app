import { CANVAS_CONTROLS } from './event-vocab';
import type { TypeAliases } from './rank';

// How the dashboard reads the look-and-feel events (docs/specs/017-telemetry/telemetry.md), shared by the
// Look & Feel tab's rankings and the Look & Feel stack on the Dashboard.

// Theme·Changed types that are NOT built-in theme picks, kept out of the theme ranking where they would
// otherwise compete as if they were themes. Nothing sends them any more but stored rows still carry them: `Unknown`,
// once reported for a custom theme or a tab with none (both now report Default), the one-shot "Reset elements to theme"
// recolour (`ResetElements`), removed with its button from Tab Style, and the custom-theme builder's applied and
// edited picks (`Custom`, `CustomEdited`), removed with custom themes.
const NON_THEME_TYPES: ReadonlySet<string> = new Set([
  'Unknown',
  'ResetElements',
  'Custom',
  'CustomEdited',
]);

/** Whether a Theme·Changed type is not a built-in theme pick. */
export const isNonThemePick = (t: string | undefined | null): boolean =>
  NON_THEME_TYPES.has(t ?? '');

// The built-in brand theme was labelled Basic until #73 renamed it Default
// (packages/project themes-data.ts), and the token follows the label. Rows
// stored before the rename fold into Default so one theme ranks once.
export const THEME_ALIASES: TypeAliases = { Basic: 'Default' };

// Canvas·Changed types that are NOT a background pattern: the colour /
// opacity / scale / animation-speed controls in the canvas panel
// (CANVAS_CONTROLS). The Canvas Styles ranking is patterns only, so these
// stay out of it.
export const NON_PATTERN_CANVAS_TYPES: readonly string[] = Object.keys(CANVAS_CONTROLS);
