import { describe, expect, it } from 'vitest';
import { validateFields } from './fields';
import type { ItemFieldValue } from './item';
import {
  ITEM_RICH_RUNS_MAX,
  isRichFieldKey,
  normaliseRichRuns,
  richFieldOf,
  richRunsOf,
  runsAreMarked,
} from './rich-text-field';

// docs/specs/026-plan/items.md "Fields": descriptionRich.
describe('descriptionRich', () => {
  it('keeps runs with known marks, dropping unknown keys and false flags', () => {
    expect(
      normaliseRichRuns([
        { text: 'Hi ', bold: true, italic: false, junk: 1 },
        { text: 'there', link: 'https://x.dev', color: '#112233', size: 'lg', heading: 2 },
      ]),
    ).toEqual([
      { text: 'Hi ', bold: true },
      { text: 'there', link: 'https://x.dev', color: '#112233', size: 'lg', heading: 2 },
    ]);
  });

  it('refuses unsafe links and malformed marks', () => {
    expect(normaliseRichRuns([{ text: 'x', link: 'javascript:alert(1)' }])).toBeUndefined();
    expect(normaliseRichRuns([{ text: 'x', color: 'red' }])).toBeUndefined();
    expect(normaliseRichRuns([{ text: 'x', size: 'xl' }])).toBeUndefined();
    expect(normaliseRichRuns([{ text: 'x', heading: 4 }])).toBeUndefined();
    expect(normaliseRichRuns([{ text: 'x', bold: 'yes' }])).toBeUndefined();
    expect(normaliseRichRuns([{ bold: true }])).toBeUndefined();
    expect(normaliseRichRuns(['x'])).toBeUndefined();
    expect(normaliseRichRuns('x')).toBeUndefined();
  });

  it('bounds the runs and their text', () => {
    expect(
      normaliseRichRuns(Array.from({ length: ITEM_RICH_RUNS_MAX + 1 }, () => ({ text: 'a' }))),
    ).toBeUndefined();
    expect(normaliseRichRuns([{ text: 'a'.repeat(10_001) }])).toBeUndefined();
  });

  it('rides an item write', () => {
    const ok = validateFields({ descriptionRich: [{ text: 'a', bold: true }] }, 'patch');
    expect(ok).toEqual({ ok: true, fields: { descriptionRich: [{ text: 'a', bold: true }] } });
    expect(validateFields({ descriptionRich: [{ text: 1 }] }, 'patch')).toMatchObject({
      ok: false,
      field: 'descriptionRich',
    });
  });
});

// docs/specs/026-plan/item-types.md "An item type": a Long Text field's formatting, `<id>Rich`.
describe('a Long Text field’s formatting', () => {
  it('is kept under the field’s id and Rich, and only there', () => {
    expect(richFieldOf('f-steps')).toBe('f-stepsRich');
    expect(richFieldOf('description')).toBe('descriptionRich');
    expect(isRichFieldKey('f-stepsRich')).toBe(true);
    expect(isRichFieldKey('descriptionRich')).toBe(true);
    expect(isRichFieldKey('f-steps')).toBe(false);
    expect(isRichFieldKey('labelsRich')).toBe(false);
    expect(isRichFieldKey('f-Rich')).toBe(false);
  });

  it('rides an item write, held to the field’s own limit', () => {
    const runs = [{ text: 'Go', bold: true }];
    expect(validateFields({ 'f-stepsRich': runs }, 'patch')).toEqual({
      ok: true,
      fields: { 'f-stepsRich': runs },
    });
    expect(validateFields({ 'f-stepsRich': [{ text: 'a'.repeat(2001) }] }, 'patch')).toMatchObject({
      ok: false,
      field: 'f-stepsRich',
    });
    expect(validateFields({ descriptionRich: [{ text: 'a'.repeat(2001) }] }, 'patch').ok).toBe(
      true,
    );
  });

  it('reads only while its text still spells the field’s value', () => {
    const runs: ItemFieldValue[] = [{ text: 'Open ' }, { text: 'it', italic: true }];
    expect(richRunsOf({ 'f-s': 'Open it', 'f-sRich': runs }, 'f-s')).toBe(runs);
    expect(richRunsOf({ 'f-s': 'Rewritten', 'f-sRich': runs }, 'f-s')).toBeUndefined();
    expect(richRunsOf({ 'f-sRich': runs }, 'f-s')).toBeUndefined();
    expect(richRunsOf({ 'f-s': 'x', 'f-sRich': [] }, 'f-s')).toBeUndefined();
    expect(richRunsOf({ 'f-s': 'x', 'f-sRich': ['x'] }, 'f-s')).toBeUndefined();
    expect(richRunsOf({ 'f-s': 'x', 'f-sRich': [{ text: 1 }] }, 'f-s')).toBeUndefined();
  });

  it('is worth keeping only when a run is marked', () => {
    expect(runsAreMarked([{ text: 'a' }, { text: 'b' }])).toBe(false);
    expect(runsAreMarked([{ text: 'a' }, { text: 'b', bold: true }])).toBe(true);
    expect(runsAreMarked([null])).toBe(false);
  });
});
