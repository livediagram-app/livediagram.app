import { describe, expect, it } from 'vitest';
import { CATEGORY_DESCRIPTIONS, categoryColor, eventLabel, typeLabel } from './event-vocab';

// The dashboard's vocabulary layer (spec/22): pure labelling helpers behind
// the public /telemetry page. First tests for this app.

describe('eventLabel', () => {
  it('joins action and type with a separator, title-cased', () => {
    expect(eventLabel({ action: 'Added', type: 'code-block' })).toBe('Added · Code Block');
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
    expect(typeLabel('SessionButton')).toBe('Session Button');
    expect(typeLabel('AiOn')).toBe('AI On');
    expect(typeLabel('Idea-box')).toBe('Idea Box');
    expect(typeLabel('your-first-diagram')).toBe('Your First Diagram');
    expect(typeLabel('Http403.SaveTab')).toBe('Http403.SaveTab');
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
