import { describe, expect, it } from 'vitest';
import type { ItemTypeDef } from '../item-types';
import { fitFields } from './tracker-fit';
import { isTrackerSource, TRACKER_SOURCES } from './tracker-model';
import { trackerCardType } from './tracker-type';

// docs/specs/026-plan/tracker-import.md "The card type" and "Fields".

describe('isTrackerSource', () => {
  it('names the four sources only', () => {
    expect(TRACKER_SOURCES.every(isTrackerSource)).toBe(true);
    expect(isTrackerSource('notion')).toBe(false);
    expect(isTrackerSource(1)).toBe(false);
  });
});

describe('trackerCardType', () => {
  it('makes a type with only the built-ins the file fills, and distinct custom ids', () => {
    const t = trackerCardType(
      'asana',
      new Set(['due']),
      [
        { key: 'a', label: `${'p'.repeat(28)} one`, kind: 'text' },
        { key: 'b', label: `${'p'.repeat(28)} two`, kind: 'text' },
        { key: 'c', label: '???', kind: 'choice', options: ['A'] },
      ],
      ['todo'],
      [],
    );
    expect(t.type.fields).toEqual([
      'title',
      'description',
      'status',
      'due',
      'comments',
      `f-${'p'.repeat(28)}`,
      `f-${'p'.repeat(28)}-2`,
      'f-field',
    ]);
    expect(t.type.custom![2]).toEqual({
      id: 'f-field',
      label: '???',
      kind: 'choice',
      options: ['A'],
    });
    expect(t).toMatchObject({ isNew: true, fits: true });
  });

  it('merges into the plan’s own type: fields it lacks, statuses, options up to the cap', () => {
    const own: ItemTypeDef = {
      id: 'jira-issue',
      label: 'Bugs',
      glyph: 'ticket',
      color: '#000000',
      newTitle: 'New bug',
      fields: ['title', 'f-type'],
      custom: [
        {
          id: 'f-type',
          label: 'Issue Type',
          kind: 'choice',
          options: Array.from({ length: 19 }, (_, i) => `O${i}`),
        },
        { id: 'f-team', label: 'Team', kind: 'text' },
        { id: 'f-plain', label: 'Plain', kind: 'choice' },
      ],
    };
    const t = trackerCardType(
      'jira',
      new Set(),
      [
        { key: 'type', label: 'issue type', kind: 'choice', options: ['O1', 'New', 'Extra'] },
        { key: 'team', label: 'Team', kind: 'text' },
        { key: 'plain', label: 'Plain', kind: 'choice' },
      ],
      ['todo', 'done'],
      [own],
    );
    expect(t.isNew).toBe(false);
    expect(t.type.label).toBe('Bugs');
    expect(t.type.custom![0]!.options).toHaveLength(20);
    expect(t.type.custom![0]!.options!.at(-1)).toBe('New');
    expect(t.type.custom![2]!.options).toEqual([]);
    expect(t.type.fields).toEqual([
      'title',
      'f-type',
      'description',
      'status',
      'comments',
      'f-team',
      'f-plain',
    ]);
    expect(t.type.statuses).toEqual(['todo', 'done']);
    expect(t.newFields.size).toBe(0);
    expect([...t.fieldOf.keys()]).toEqual(['type', 'team', 'plain']);
  });
});

describe('fitFields', () => {
  it('keeps fields that fit as they are', () => {
    expect(fitFields({ title: 'A' })).toEqual({ fields: { title: 'A' }, shortened: false });
  });

  it('refuses fields that are wrong for any reason but size', () => {
    expect(fitFields({ title: 'A', due: 'soon' })).toBeNull();
  });

  it('drops checklist rows from the end when the rest of the card is too large without its description', () => {
    const bulk = Object.fromEntries(
      Array.from({ length: 4 }, (_, i) => [`f-x${i}`, 'x'.repeat(1900)]),
    );
    const checklist = Array.from({ length: 50 }, (_, i) => ({
      text: `${i} ${'c'.repeat(190)}`,
      done: false,
    }));
    const fit = fitFields({ title: 'A', description: 'd'.repeat(5000), checklist, ...bulk })!;
    expect(fit.shortened).toBe(true);
    expect(fit.fields['description']).toBeUndefined();
    const rows = fit.fields['checklist'] as unknown[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(50);
  });

  it('drops the checklist whole when no row fits, and refuses what still does not fit', () => {
    const bulk = {
      ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`f-x${i}`, 'x'.repeat(2000)])),
      'f-y': 'y'.repeat(100),
    };
    const one = fitFields({
      title: 'A',
      checklist: [{ text: 'c'.repeat(200), done: false }],
      ...bulk,
    });
    expect(one).toMatchObject({ shortened: true });
    expect(one!.fields['checklist']).toBeUndefined();
    const huge = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`f-x${i}`, 'x'.repeat(1990)]),
    );
    expect(fitFields({ title: 'A', ...huge })).toBeNull();
  });
});
