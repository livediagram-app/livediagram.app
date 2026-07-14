import type { TelemetryCount } from '@livediagram/api-schema';
import { describe, expect, it } from 'vitest';
import {
  CATEGORY_DESCRIPTIONS,
  categoryColor,
  eventExplanation,
  eventLabel,
  groupByCategory,
} from './event-vocab';

// The dashboard's vocabulary layer (spec/22): pure grouping + labelling
// helpers behind the public /telemetry page. First tests for this app.

const row = (category: string, action: string, count: number, type: string | null = null) =>
  ({ category, action, type, count }) as TelemetryCount;

describe('groupByCategory', () => {
  it('groups rows per category, sorts groups and items by count, and subtotals', () => {
    const groups = groupByCategory([
      row('Element', 'Added', 5),
      row('Diagram', 'Created', 40),
      row('Element', 'Deleted', 30),
      row('Diagram', 'Opened', 10),
    ]);
    // Element (35) < Diagram (50): biggest group first.
    expect(groups.map((g) => g.category)).toEqual(['Diagram', 'Element']);
    expect(groups[0]!.subtotal).toBe(50);
    // Items inside a group are busiest-first too.
    expect(groups[1]!.items.map((i) => i.action)).toEqual(['Deleted', 'Added']);
  });

  it('returns an empty list for no rows', () => {
    expect(groupByCategory([])).toEqual([]);
  });
});

describe('eventLabel', () => {
  it('joins action and type with a separator, title-cased', () => {
    expect(eventLabel({ action: 'Added', type: 'code-block' })).toBe('Added · Code-Block');
  });

  it('falls back to the action alone when there is no type', () => {
    expect(eventLabel({ action: 'Opened', type: null })).toBe('Opened');
  });
});

describe('categoryColor', () => {
  it('gives an unknown category the neutral slate instead of crashing', () => {
    expect(categoryColor('NotARealCategory')).toBe('#94a3b8');
  });

  it('gives every known category a non-neutral colour', () => {
    for (const category of Object.keys(CATEGORY_DESCRIPTIONS)) {
      expect(categoryColor(category), category).not.toBe('#94a3b8');
    }
  });
});

describe('eventExplanation', () => {
  it('prefers the most specific rule (category + action + type)', () => {
    expect(eventExplanation('Element', 'Added', 'Square')).toBe(
      'Someone dropped a square onto the canvas.',
    );
  });

  it('always produces a non-empty sentence, even off the known paths', () => {
    // The layered fallbacks are the point: whatever combination arrives
    // (already vocabulary-validated upstream), the tooltip never renders
    // blank.
    const out = eventExplanation('Token', 'Revoked', null);
    expect(out.length).toBeGreaterThan(0);
    const generic = eventExplanation('UI', 'Zoomed', 'SomethingNew');
    expect(generic.length).toBeGreaterThan(0);
  });
});
