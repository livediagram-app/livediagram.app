import { describe, expect, it } from 'vitest';
import { presetSummaryLines } from './power-user-preset-rows';
import { setPowerUserMode } from '@/lib/power-user-mode';

// The "Set By Power User Mode" readout (docs/specs/007-editor/power-user-mode.md#in-settings).

const ALL = new Set(['planTourSeen', 'formTourSeen']);

describe('presetSummaryLines', () => {
  it('lists every preset setting but Minimal chrome, with its value and home', () => {
    const prefs = setPowerUserMode({}, true).prefs;
    const lines = presetSummaryLines(prefs, ALL);
    expect(lines.map((l) => [l.label, l.value, l.categoryLabel])).toEqual([
      ['Plan Tours', 'Off', 'Tours'],
      ['Forms Tour', 'Off', 'Tours'],
    ]);
    expect(lines.every((l) => !l.changed && l.reachable)).toBe(true);
  });

  it('marks a setting changed since switching on, as switch-off would', () => {
    const prefs = { ...setPowerUserMode({}, true).prefs, formTourSeen: false };
    const forms = presetSummaryLines(prefs, ALL).find((l) => l.rowKey === 'formTourSeen')!;
    expect(forms.value).toBe('On');
    expect(forms.changed).toBe(true);
  });

  it('makes no promise about switching off without a baseline to restore from', () => {
    const lines = presetSummaryLines({ powerUserMode: true, formTourSeen: true }, ALL);
    expect(lines.every((l) => l.restorable === false)).toBe(true);
    expect(
      presetSummaryLines(setPowerUserMode({}, true).prefs, ALL).every((l) => l.restorable),
    ).toBe(true);
  });

  it('shows a row that is not offered here without a way to it', () => {
    const offered = new Set(ALL);
    offered.delete('formTourSeen');
    const forms = presetSummaryLines(setPowerUserMode({}, true).prefs, offered).find(
      (l) => l.rowKey === 'formTourSeen',
    )!;
    expect(forms.reachable).toBe(false);
  });
});
