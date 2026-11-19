import { BRAND_APPS } from '@liveworkspace/brand/svg';
import type { AppId } from '@liveworkspace/help-registry';
import type { CSSProperties } from 'react';

// Each app's colours where the help centre names an app on a page in another app's theme (liveworkspace/docs/specs/
// 017-help/blueprints/help-centre.md "MDX components"): its mark in the Applies To row, a note's tint. The page's own
// `brand-*` classes are the scope's, so another app's colours come from its brand ramp (@liveworkspace/brand
// BRAND_APPS) as custom properties, which the classes below read; the `.dark` steps swap in under the dark class.

/** An app's mark colour: its brand-600 on paper, its 400 on dark. Read by `APP_MARK_CLASS`. */
export function appMarkStyle(app: AppId): CSSProperties {
  const { ramp } = BRAND_APPS[app];
  return { '--app-mark': ramp[600], '--app-mark-dark': ramp[400] } as CSSProperties;
}

export const APP_MARK_CLASS = 'text-(--app-mark) dark:text-(--app-mark-dark)';

/** An app's ring colour, for the current app's mark: its brand-500 at both appearances. */
export function appRingStyle(app: AppId): CSSProperties {
  return { '--app-ring': BRAND_APPS[app].ramp[500] } as CSSProperties;
}

/**
 * An app note's palette: background brand-50, border brand-200, label brand-700, text brand-900, and on dark the
 * 950, 800, 300 and 100 steps. Read by the `NOTE_*` classes.
 */
export function appNoteStyle(app: AppId): CSSProperties {
  const { ramp } = BRAND_APPS[app];
  return {
    '--note-bg': ramp[50],
    '--note-border': ramp[200],
    '--note-label': ramp[700],
    '--note-text': ramp[900],
    '--note-bg-dark': ramp[950],
    '--note-border-dark': ramp[800],
    '--note-label-dark': ramp[300],
    '--note-text-dark': ramp[100],
  } as CSSProperties;
}

export const NOTE_BOX_CLASS =
  'border-(--note-border) bg-(--note-bg) dark:border-(--note-border-dark) dark:bg-(--note-bg-dark)';
export const NOTE_LABEL_CLASS = 'text-(--note-label) dark:text-(--note-label-dark)';
export const NOTE_TEXT_CLASS = 'text-(--note-text) dark:text-(--note-text-dark)';

/** A band in an app's palette, for its tile on the All Apps home: its 100 into its 300, its 900 into 700 on dark. */
export function appBandStyle(app: AppId): CSSProperties {
  const { ramp } = BRAND_APPS[app];
  return {
    '--band-from': ramp[100],
    '--band-to': ramp[300],
    '--band-from-dark': ramp[950],
    '--band-to-dark': ramp[800],
    '--band-ink': ramp[700],
    '--band-ink-dark': ramp[300],
  } as CSSProperties;
}

export const BAND_CLASS =
  'bg-gradient-to-br from-(--band-from) to-(--band-to) dark:from-(--band-from-dark) dark:to-(--band-to-dark)';
export const BAND_INK_CLASS = 'text-(--band-ink) dark:text-(--band-ink-dark)';
