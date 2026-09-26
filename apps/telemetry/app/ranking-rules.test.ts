import { describe, expect, it } from 'vitest';
import type { TelemetryCount } from '@livediagram/api-schema';
import { isRecovery, isServerCrash } from './ExceptionsView';
import { NON_PATTERN_CANVAS_TYPES, THEME_ALIASES } from './LookAndFeelView';
import { PALETTE_TYPE_ALIASES, SELECTION_MODES } from './PaletteView';
import { isHelpArticleType, isSettingsCategory } from './opened-types';
import { aliasedSeries, foldAliases, rank } from './rank';
import { TOUR_STEP_TYPES, tourStepRows } from './tour-steps';

// The read-time rules the rankings apply to stored rows (docs/specs/017-telemetry/telemetry.md): folding old
// spellings into today's token, and keeping events that aren't the thing a
// card names out of it.

const row = (category: string, action: string, type: string | null, count: number) =>
  ({ category, action, type, count }) as TelemetryCount;

describe('foldAliases / rank', () => {
  it('folds an old spelling into its current token, summing the counts', () => {
    const rows = [
      row('Element', 'Added', 'Code-block', 3),
      row('Element', 'Added', 'CodeBlock', 4),
      row('Element', 'Added', 'Square', 5),
    ];
    expect(foldAliases(rows, PALETTE_TYPE_ALIASES)).toEqual([
      row('Element', 'Added', 'CodeBlock', 7),
      row('Element', 'Added', 'Square', 5),
    ]);
  });

  it('lets a predicate over current tokens see the folded history', () => {
    const rows = [row('Element', 'Added', 'Mind-node', 2), row('Element', 'Added', 'Square', 1)];
    const kinds = ['MindNode', 'Square'];
    expect(rank(rows, (r) => kinds.includes(r.type ?? ''), PALETTE_TYPE_ALIASES)).toEqual([
      row('Element', 'Added', 'MindNode', 2),
      row('Element', 'Added', 'Square', 1),
    ]);
    // Without the aliases the old spelling isn't in the catalogue and vanishes.
    expect(rank(rows, (r) => kinds.includes(r.type ?? ''))).toHaveLength(1);
  });

  it('ranks one theme once across its rename from Basic to Default', () => {
    const rows = [row('Theme', 'Changed', 'Basic', 6), row('Theme', 'Changed', 'Default', 1)];
    expect(rank(rows, () => true, THEME_ALIASES)).toEqual([row('Theme', 'Changed', 'Default', 7)]);
  });

  it("sums a folded row's trend line with its old spelling's", () => {
    const byMetric = {
      'Element|Added|CodeBlock': [0, 1, 2],
      'Element|Added|Code-block': [5, 1, 0],
    };
    expect(aliasedSeries(byMetric, 'Element', 'Added', 'CodeBlock', PALETTE_TYPE_ALIASES)).toEqual([
      5, 2, 2,
    ]);
    expect(aliasedSeries(byMetric, 'Element', 'Added', 'CodeBlock')).toEqual([0, 1, 2]);
    expect(aliasedSeries(byMetric, 'Element', 'Added', 'Square', PALETTE_TYPE_ALIASES)).toBe(
      undefined,
    );
  });

  it('only aliases to tokens that are not themselves aliased', () => {
    for (const aliases of [PALETTE_TYPE_ALIASES, THEME_ALIASES]) {
      for (const to of Object.values(aliases)) expect(aliases[to]).toBeUndefined();
    }
  });
});

describe('what each ranking leaves out', () => {
  it('Selection Modes excludes the Canvas·Used events that are not modes', () => {
    expect(SELECTION_MODES).not.toContain('InsertBetween');
    expect(SELECTION_MODES).not.toContain('FollowMe');
  });

  it('Canvas Styles excludes the colour, opacity and scale controls', () => {
    for (const t of [
      'BackgroundColor',
      'BackgroundOpacity',
      'PatternColor',
      'BackgroundPatternScale',
    ])
      expect(NON_PATTERN_CANVAS_TYPES).toContain(t);
    expect(NON_PATTERN_CANVAS_TYPES).not.toContain('Grid');
  });
});

describe('error predicates', () => {
  it('reads a server crash in both the old and the located form', () => {
    expect(isServerCrash('Internal')).toBe(true); // before #112
    expect(isServerCrash('Internal.Put.Diagrams.Tabs')).toBe(true);
    expect(isServerCrash('Internal.Get.Unknown')).toBe(true);
  });

  it('keeps caller-observed failures out of the server crash count', () => {
    expect(isServerCrash('Http500')).toBe(false);
    expect(isServerCrash('Http500.SaveTab')).toBe(false);
    expect(isServerCrash('Network.Put.Diagrams.Tabs')).toBe(false);
    // The MCP worker's call to the api never completed: seen by the caller.
    expect(isServerCrash('Internal.FindDiagrams')).toBe(false);
    expect(isServerCrash(null)).toBe(false);
  });

  it('treats a realtime resync as a recovery, not an exception', () => {
    expect(isRecovery('RealtimeResync')).toBe(true);
    expect(isRecovery('Uncaught')).toBe(false);
    expect(isRecovery('Uncaught.Diagram.TypeError')).toBe(false);
    expect(isRecovery('Render.Canvas.Other')).toBe(false);
  });
});

describe('UI·Opened splits', () => {
  it('tells a Settings category apart from the dialog opening', () => {
    expect(isSettingsCategory('SettingsAppearance')).toBe(true);
    expect(isSettingsCategory('Settings')).toBe(false);
    expect(isSettingsCategory('Share')).toBe(false);
    expect(isSettingsCategory(null)).toBe(false);
  });

  it('reads a lowercase type as a help article opened from the editor', () => {
    expect(isHelpArticleType('your-first-diagram')).toBe(true);
    expect(isHelpArticleType('Settings')).toBe(false);
    expect(isHelpArticleType(null)).toBe(false);
  });
});

describe('tourStepRows', () => {
  it('lists every step in tour order, a step no one reached reading 0', () => {
    const rows = [
      row('UI', 'View', 'TourStepOutro', 1),
      row('UI', 'View', 'TourStepPalette', 9),
      row('UI', 'Opened', 'TourStepPalette', 4),
    ];
    const steps = tourStepRows(rows);
    expect(steps.map((r) => r.type)).toEqual([...TOUR_STEP_TYPES]);
    expect(steps[0]!.count).toBe(9);
    expect(steps[1]!.count).toBe(0);
    expect(steps.at(-1)!.count).toBe(1);
  });

  it('is empty when no step was viewed', () => {
    expect(tourStepRows([row('UI', 'Opened', 'TourOffer', 3)])).toEqual([]);
  });
});
