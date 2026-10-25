import { describe, expect, it } from 'vitest';
import { THEMES } from '@livedesign/design';
import { TELEMETRY_TYPE_PATTERN } from '@livedesign/api-schema';
import { themeTelemetryLabel } from './theme-telemetry-label';

// docs/specs/017-telemetry/telemetry.md's rule is categorical: a telemetry `type` is a preset token, never
// user content. These tests enforce it for the theme label every theme pick reports.

describe('themeTelemetryLabel', () => {
  it('reports a built-in theme by its catalogue label', () => {
    for (const t of THEMES) expect(themeTelemetryLabel(t.id)).toBe(t.label);
  });

  it('title-cases an id the catalogue no longer knows', () => {
    // A built-in retired from THEMES while a design still names it. Still
    // ours, so still a preset token — not user content.
    expect(themeTelemetryLabel('retired-hue')).toBe('Retired-hue');
  });

  it('reports Unknown for an id that is not one of our slugs', () => {
    // An id from outside the catalogue's shape (an old saved-theme id, anything a user could have typed).
    const ids = ['custom:1234-abcd', 'custom:Acme Rebrand', 'Project Hydra', `x${'y'.repeat(60)}`];
    for (const id of ids) expect(themeTelemetryLabel(id)).toBe('Unknown');
  });

  it('has a token for no theme at all', () => {
    expect(themeTelemetryLabel(undefined)).toBe('Unknown');
    expect(themeTelemetryLabel('')).toBe('Unknown');
  });

  it('emits a token the api will accept, for every built-in', () => {
    // A `type` is checked at ingest against TELEMETRY_TYPE_PATTERN and discarded
    // without a word when it fails, so a future theme labelled "Blue / Grey"
    // or "Rosé" would stop the Theme·Changed metric dead with nothing here
    // going red. The labels are user-facing copy, chosen for the picker rather
    // than for this, which is exactly why it needs asserting.
    for (const t of THEMES) {
      expect(themeTelemetryLabel(t.id), t.label).toMatch(TELEMETRY_TYPE_PATTERN);
    }
    expect('Unknown').toMatch(TELEMETRY_TYPE_PATTERN);
    expect(themeTelemetryLabel('retired-hue')).toMatch(TELEMETRY_TYPE_PATTERN);
    expect(THEMES.length).toBeGreaterThan(10);
  });

  it('emits nothing that could be a name a user typed', () => {
    // Whole-surface check: for every input shape the callers can produce, the
    // result is either a catalogue label or the fixed token.
    const allowed = new Set([...THEMES.map((t) => t.label), 'Unknown']);
    const inputs = [...THEMES.map((t) => t.id), 'custom:Secret Client', undefined, ''];
    for (const i of inputs) expect(allowed.has(themeTelemetryLabel(i))).toBe(true);
  });
});
