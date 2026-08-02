import { describe, expect, it } from 'vitest';
import { THEMES } from '@livediagram/diagram';
import { themeTelemetryLabel } from './custom-theme-registry';

// spec/22's rule is categorical: a telemetry `type` is a preset token, never
// user content. A custom theme's name is user content — someone's client,
// someone's project — so it must never leave the browser.
//
// Three call sites derived this label independently and two held a
// byte-identical copy of the ternary. The comments said the right thing; only
// the reviewer's attention enforced it. These tests enforce it instead.

describe('themeTelemetryLabel', () => {
  it('reports a built-in theme by its catalogue label', () => {
    for (const t of THEMES) expect(themeTelemetryLabel(t.id)).toBe(t.label);
  });

  it('never reports a custom theme by anything but the fixed token', () => {
    // The names below are what a real leak would look like in the dashboard.
    for (const name of ['Acme Rebrand', 'client-confidential', 'Project Hydra', '']) {
      expect(themeTelemetryLabel(`custom:${name}`)).toBe('Custom');
    }
  });

  it('reports Custom for any custom id, whatever it carries', () => {
    // The prefix is the whole test: no lookup, no fallback, no chance for a
    // registry miss to fall through to the id itself.
    const ids = ['custom:', 'custom:1234-abcd', `custom:${'x'.repeat(200)}`, 'custom:Café ☕'];
    for (const id of ids) expect(themeTelemetryLabel(id)).toBe('Custom');
  });

  it('title-cases an id the catalogue no longer knows', () => {
    // A built-in retired from THEMES while a diagram still names it. Still
    // ours, so still a preset token — not user content.
    expect(themeTelemetryLabel('retired-hue')).toBe('Retired-hue');
  });

  it('has a token for no theme at all', () => {
    expect(themeTelemetryLabel(undefined)).toBe('Unknown');
    expect(themeTelemetryLabel('')).toBe('Unknown');
  });

  it('emits nothing that could be a name a user typed', () => {
    // Whole-surface check: for every input shape the callers can produce, the
    // result is either a catalogue label or one of the two fixed tokens.
    const allowed = new Set([...THEMES.map((t) => t.label), 'Custom', 'Unknown']);
    const inputs = [...THEMES.map((t) => t.id), 'custom:Secret Client', undefined, ''];
    for (const i of inputs) expect(allowed.has(themeTelemetryLabel(i))).toBe(true);
  });
});
