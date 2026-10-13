import { describe, expect, it } from 'vitest';
import { checklistProgress, currencyText, customFieldText, dayLabel, linkHost } from './card-text';
import type { CustomFieldDef } from './item-types';
import type { Item } from './item';

// docs/specs/026-plan/item-types.md "Card display": a card's values as the face and every export show them.
const field = (kind: CustomFieldDef['kind'], extra: Partial<CustomFieldDef> = {}): CustomFieldDef =>
  ({ id: 'f', name: 'F', kind, ...extra }) as CustomFieldDef;

describe('dayLabel', () => {
  it('formats a saved day in each style, reusing its formatter', () => {
    const short = dayLabel('2026-10-30');
    expect(short).toMatch(/30/);
    expect(dayLabel('2026-10-30')).toBe(short);
    expect(dayLabel('2026-10-30', 'medium')).toMatch(/2026/);
    expect(dayLabel('2026-10-30', 'long')).toMatch(/2026/);
  });

  it('leaves a value that is not a day as it is', () => {
    expect(dayLabel('soon')).toBe('soon');
  });
});

describe('customFieldText', () => {
  it('shows nothing for an empty value', () => {
    for (const v of [undefined, null, '']) expect(customFieldText(field('text'), v)).toBeNull();
  });

  it('reads each kind, and nothing for a value of the wrong kind', () => {
    expect(customFieldText(field('checkbox'), true)).toBe('Yes');
    expect(customFieldText(field('checkbox'), false)).toBe('No');
    expect(customFieldText(field('checkbox'), 'x')).toBeNull();
    expect(customFieldText(field('number'), 82000)).toBe((82000).toLocaleString());
    expect(customFieldText(field('number'), 'x')).toBeNull();
    expect(customFieldText(field('date'), '2026-10-30')).toBe(dayLabel('2026-10-30', 'medium'));
    expect(customFieldText(field('date'), 3)).toBeNull();
    expect(customFieldText(field('link'), 'https://www.sentry.io/x')).toBe('sentry.io');
    expect(customFieldText(field('link'), 3)).toBeNull();
    expect(customFieldText(field('currency', { currency: 'GBP' }), 12)).toBe(
      currencyText(12, 'GBP'),
    );
    expect(customFieldText(field('currency'), 'x')).toBeNull();
    expect(customFieldText(field('email'), 'a@b.co')).toBe('a@b.co');
    expect(customFieldText(field('email'), 3)).toBeNull();
    expect(customFieldText(field('text'), 'first\nsecond')).toBe('first');
    expect(customFieldText(field('text'), 3)).toBeNull();
  });

  it('names the card a Card field points at', () => {
    const items = new Map([['c1', { id: 'c1', fields: { title: 'Ship it' } } as unknown as Item]]);
    expect(customFieldText(field('card'), 'c1', items)).toMatch(/Ship it/);
  });
});

describe('currencyText', () => {
  it('drops pence on a whole amount and keeps two places otherwise', () => {
    expect(currencyText(12500, 'GBP')).not.toMatch(/\.\d/);
    expect(currencyText(1200.5, 'USD')).toMatch(/\.50/);
    expect(currencyText(5)).toBeTruthy();
  });

  it('falls back to the code for a currency the locale cannot write', () => {
    expect(currencyText(5, 'NOT-A-CODE')).toBe(`NOT-A-CODE ${(5).toLocaleString()}`);
  });
});

describe('linkHost', () => {
  it('shows a site without www, and an address without its scheme otherwise', () => {
    expect(linkHost('https://www.example.com/a')).toBe('example.com');
    expect(linkHost('http://not a url')).toBe('not a url');
    expect(linkHost('mailto:')).toBe('mailto:');
  });
});

describe('checklistProgress', () => {
  it('counts done of total, null without a checklist', () => {
    expect(checklistProgress({ fields: {} })).toBeNull();
    expect(checklistProgress({ fields: { checklist: [] } })).toBeNull();
    expect(
      checklistProgress({ fields: { checklist: [{ done: true }, { done: false }, null] } }),
    ).toEqual({ done: 1, total: 3 });
  });
});
