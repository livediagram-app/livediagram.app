import { describe, expect, it } from 'vitest';
import { validateFields } from './fields';
import { ITEM_RICH_RUNS_MAX, normaliseRichRuns } from './rich-text-field';

// docs/specs/025-plan/items.md "Fields": descriptionRich.
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
