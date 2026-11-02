import { describe, expect, it } from 'vitest';
import { THEMES } from '@livehuddle/document';
import { TELEMETRY_TYPE_PATTERN } from '@livehuddle/api-schema';
import { themeTelemetryLabel } from './theme-telemetry-label';

// docs/specs/017-telemetry/telemetry.md's rule is categorical: a telemetry `type` is a preset token, never
// user content. These tests hold every call site to it.

describe('themeTelemetryLabel', () => {
  it('reports a built-in theme by its catalogue label', () => {
    for (const t of THEMES) expect(themeTelemetryLabel(t.id)).toBe(t.label);
  });

  it('never reports a retired custom theme id', () => {
    // Custom themes are gone and their ids are moved to Default on read; one that slips through is no preset.
    for (const id of ['custom:', 'custom:1234-abcd', 'custom:Café ☕']) {
      expect(themeTelemetryLabel(id)).toBe('Default');
    }
  });

  it('title-cases an id the catalogue no longer knows', () => {
    // A built-in retired from THEMES while a document still names it. Still
    // ours, so still a preset token — not user content.
    expect(themeTelemetryLabel('retired-hue')).toBe('Retired-hue');
  });

  it('reports no theme at all as Default, the theme the tab shows', () => {
    expect(themeTelemetryLabel(undefined)).toBe('Default');
    expect(themeTelemetryLabel('')).toBe('Default');
  });

  it('emits a token the api will accept, for every built-in', () => {
    // Privacy is one failure mode; being dropped at the door is another. A
    // `type` is checked at ingest against TELEMETRY_TYPE_PATTERN and discarded
    // without a word when it fails, so a future theme labelled "Blue / Grey"
    // or "Rosé" would stop the Theme·Changed metric dead with nothing here
    // going red. The labels are user-facing copy, chosen for the picker rather
    // than for this, which is exactly why it needs asserting.
    for (const t of THEMES) {
      expect(themeTelemetryLabel(t.id), t.label).toMatch(TELEMETRY_TYPE_PATTERN);
    }
    // The retired-built-in fallback title-cases a raw id; it must clear the
    // pattern too, and the 40-character cap is the part an id can breach.
    expect(themeTelemetryLabel('retired-hue')).toMatch(TELEMETRY_TYPE_PATTERN);
    expect(THEMES.length).toBeGreaterThan(10);
  });

  it('emits nothing that could be a name a user typed', () => {
    // Whole-surface check: for every input shape the callers can produce, the
    // result is a catalogue label.
    const allowed = new Set(THEMES.map((t) => t.label));
    const inputs = [...THEMES.map((t) => t.id), 'custom:Secret Client', undefined, ''];
    for (const i of inputs) expect(allowed.has(themeTelemetryLabel(i))).toBe(true);
  });
});
