import { describe, expect, it } from 'vitest';
import { presetSummaryLines } from './power-user-preset-rows';
import { setPowerUserMode } from '@/lib/power-user-mode';

// The "Set By Power User Mode" readout (docs/specs/007-editor/power-user-mode.md#in-settings).

const ALL = new Set([
  'alignmentGuides',
  'autoRebindArrows',
  'tourSeen',
  'planTourSeen',
  'aiSuggestedPrompts',
]);

describe('presetSummaryLines', () => {
  it('lists every preset setting but Minimal chrome, with its value and home', () => {
    const prefs = setPowerUserMode({}, true).prefs;
    const lines = presetSummaryLines(prefs, ALL);
    expect(lines.map((l) => [l.label, l.value, l.categoryLabel])).toEqual([
      ['Alignment Guides', 'On', 'Editor'],
      ['Auto-Attach Arrows', 'On', 'Editor'],
      ['Show Welcome Tour', 'Off', 'Accessibility'],
      ['Show Plan Tour', 'Off', 'Accessibility'],
      ['Suggested Prompts', 'Off', 'AI Tools'],
    ]);
    expect(lines.every((l) => !l.changed && l.reachable)).toBe(true);
  });

  it('marks a setting changed since switching on, as switch-off would', () => {
    const prefs = { ...setPowerUserMode({}, true).prefs, alignmentGuides: false };
    const guides = presetSummaryLines(prefs, ALL).find((l) => l.rowKey === 'alignmentGuides')!;
    expect(guides.value).toBe('Off');
    expect(guides.changed).toBe(true);
  });

  it('makes no promise about switching off without a baseline to restore from', () => {
    const lines = presetSummaryLines({ powerUserMode: true, alignmentGuides: true }, ALL);
    expect(lines.every((l) => l.restorable === false)).toBe(true);
    expect(
      presetSummaryLines(setPowerUserMode({}, true).prefs, ALL).every((l) => l.restorable),
    ).toBe(true);
  });

  it('shows a row that is not offered here without a way to it', () => {
    const offered = new Set(ALL);
    offered.delete('aiSuggestedPrompts');
    const prompts = presetSummaryLines(setPowerUserMode({}, true).prefs, offered).find(
      (l) => l.rowKey === 'aiSuggestedPrompts',
    )!;
    expect(prompts.reachable).toBe(false);
  });
});
