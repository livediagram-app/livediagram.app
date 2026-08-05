import { describe, expect, it } from 'vitest';
import { TIMELINE_EVENT_TYPES } from '@livediagram/api-schema';
import {
  CATEGORY_LABELS,
  categoryToken,
  eventCategory,
  sortCategories,
  type TimelineCategory,
} from './eventCategory';

// The filter chips (spec/138 §2.3) had no tests at all, while the tone mapping
// beside them had a whole file. Both answer "what happened", and getting the
// category wrong is the quieter failure of the two: an event lands under a chip
// nobody would think to look under, or under Other, where turning the chip off
// hides unrelated things with it.

describe('eventCategory', () => {
  it('gives every event type it knows a real chip, never Other', () => {
    // Exhaustiveness itself is the compiler's job now (BY_EVENT is keyed on
    // KnownTimelineEventType). What this catches is an entry written as the
    // catch-all: 'other' is correct for a row from a newer worker and never for
    // an event type this build ships.
    const unfiltered = TIMELINE_EVENT_TYPES.filter((t) => eventCategory(t) === 'other');
    expect(unfiltered).toEqual([]);
  });

  it('falls to Other for an event type from a newer worker', () => {
    expect(eventCategory('some_future_event')).toBe('other');
    expect(eventCategory('')).toBe('other');
  });

  // The design decision worth pinning: chips group by CONSEQUENCE, not by which
  // table the row came from. Someone scanning for "did anything disappear?"
  // wants a lost diagram, folder, theme, team and working token in one place.
  it('groups losses together regardless of what was lost', () => {
    for (const type of [
      'diagram_deleted',
      'folder_deleted',
      'theme_deleted',
      'team_deleted',
      'token_revoked',
    ]) {
      expect(eventCategory(type)).toBe('deletions');
    }
  });

  it('counts someone reaching your work as sharing, not as a diagram event', () => {
    expect(eventCategory('diagram_opened_by_visitor')).toBe('sharing');
    expect(eventCategory('diagram_copied_by_visitor')).toBe('sharing');
    expect(eventCategory('team_diagram_added')).toBe('sharing');
    expect(eventCategory('team_diagram_removed')).toBe('sharing');
  });

  it('separates where a diagram lives from what changed inside it', () => {
    expect(eventCategory('diagram_moved')).toBe('filing');
    expect(eventCategory('diagram_offline')).toBe('filing');
    expect(eventCategory('diagram_synced')).toBe('filing');
    expect(eventCategory('diagram_edited')).toBe('edits');
  });

  it('keeps renames in one chip across diagrams and teams', () => {
    expect(eventCategory('diagram_renamed')).toBe('renames');
    expect(eventCategory('team_renamed')).toBe('renames');
  });
});

describe('CATEGORY_LABELS', () => {
  it('labels every category an event can resolve to', () => {
    const used = new Set<TimelineCategory>(TIMELINE_EVENT_TYPES.map(eventCategory));
    for (const category of used) expect(CATEGORY_LABELS[category]).toBeTruthy();
    expect(CATEGORY_LABELS.other).toBeTruthy();
  });
});

describe('sortCategories', () => {
  it('imposes the fixed chip order, not the input order', () => {
    expect(sortCategories(['account', 'comments', 'deletions'])).toEqual([
      'comments',
      'deletions',
      'account',
    ]);
  });

  it('is stable whichever way the input arrives', () => {
    const forwards = sortCategories(['teams', 'new', 'edits']);
    const backwards = sortCategories(['edits', 'new', 'teams']);
    expect(forwards).toEqual(backwards);
  });

  it('orders every category, so no chip drifts to the end by accident', () => {
    const all = Object.keys(CATEGORY_LABELS) as TimelineCategory[];
    const sorted = sortCategories(all);
    // ORDER is private; an unlisted category would sort to indexOf -1 and jump
    // to the front, so 'other' arriving last is the observable proof it is
    // covered along with everything before it.
    expect(sorted).toHaveLength(all.length);
    expect(sorted.at(-1)).toBe('other');
  });
});

describe('categoryToken', () => {
  it('sends the id rather than the label, so telemetry survives a rewording', () => {
    expect(categoryToken('new')).toBe('new');
    expect(categoryToken('new')).not.toBe(CATEGORY_LABELS.new);
    // spec/22 bounds the telemetry `type` slot to a short safe token.
    for (const category of Object.keys(CATEGORY_LABELS) as TimelineCategory[]) {
      expect(categoryToken(category)).toMatch(/^[a-z]{1,40}$/);
    }
  });
});
