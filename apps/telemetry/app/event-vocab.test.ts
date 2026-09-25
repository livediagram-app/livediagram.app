import { describe, expect, it } from 'vitest';
import {
  CATEGORY_DESCRIPTIONS,
  categoryColor,
  eventExplanation,
  eventLabel,
  typeLabel,
} from './event-vocab';

// The dashboard's vocabulary layer (spec/22): pure labelling helpers behind
// the public /telemetry page. First tests for this app.

describe('eventLabel', () => {
  it('joins action and type with a separator, title-cased', () => {
    expect(eventLabel({ action: 'Added', type: 'code-block' })).toBe('Added · Code-Block');
  });

  it('falls back to the action alone when there is no type', () => {
    expect(eventLabel({ action: 'Opened', type: null })).toBe('Opened');
  });

  it('shows a page path exactly as stored, not title-cased (spec/150)', () => {
    expect(eventLabel({ action: 'View', type: '/help/the-canvas' })).toBe(
      'View · /help/the-canvas',
    );
    expect(typeLabel('/alternatives/miro')).toBe('/alternatives/miro');
    expect(typeLabel('square')).toBe('Square');
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
