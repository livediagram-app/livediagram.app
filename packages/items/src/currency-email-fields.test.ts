import { describe, expect, it } from 'vitest';
import { customFieldText, currencyText } from './card-text';
import { resolveFields } from './plan-names';
import { applyCardTypeChanges } from './type-changes';
import {
  defaultCatalogue,
  validateItemTypeCatalogue,
  ITEM_TYPE_CATALOGUE_VERSION,
} from './type-catalogue';
import { ITEM_TYPES, isEmailAddress, type ItemTypeDef } from './item-types';

// The Currency and Email custom field kinds (docs/specs/026-plan/item-types.md "Custom field kinds").

const statuses = [{ status: 'todo~a1', name: 'To Do' }];
const DEAL: ItemTypeDef = {
  ...ITEM_TYPES[1]!,
  id: 'deal',
  label: 'Deal',
  fields: ['title', 'status', 'f-value', 'f-contact'],
  custom: [
    { id: 'f-value', label: 'Value', kind: 'currency', currency: 'USD' },
    { id: 'f-contact', label: 'Contact', kind: 'email' },
  ],
};
const naming = { statuses, items: [] };

describe('Currency', () => {
  it('reads as the locale writes the field’s currency, pence only when there are some', () => {
    expect(currencyText(12500, 'GBP')).toBe(
      (12500).toLocaleString(undefined, {
        style: 'currency',
        currency: 'GBP',
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      }),
    );
    expect(currencyText(1200.5, 'USD')).toContain('1,200.50');
    expect(customFieldText(DEAL.custom![0]!, 99)).toContain('99');
    expect(customFieldText({ id: 'f-x', label: 'X', kind: 'currency' }, 5)).toContain('5');
  });

  it('takes a number, or an amount written with its symbol and grouping, to the penny', () => {
    expect(resolveFields({ Value: '£12,500.456' }, DEAL, naming)).toMatchObject({
      ok: true,
      fields: { 'f-value': 12500.46 },
    });
    expect(resolveFields({ Value: 7.129 }, DEAL, naming)).toMatchObject({
      ok: true,
      fields: { 'f-value': 7.13 },
    });
    expect(resolveFields({ Value: 'lots' }, DEAL, naming)).toMatchObject({
      ok: false,
      code: 'value_invalid',
    });
  });

  it('is made and edited with its code, GBP stored as no code', () => {
    const r = applyCardTypeChanges(
      defaultCatalogue(),
      [
        {
          op: 'add',
          name: 'Deal',
          custom: [
            { name: 'Value', kind: 'currency', currency: 'usd' },
            { name: 'Fee', kind: 'currency' },
          ],
        },
        { op: 'set', type: 'Deal', editCustom: [{ field: 'Fee', currency: 'EUR' }] },
      ],
      statuses,
    );
    if (!r.ok) throw new Error(r.message);
    const deal = r.catalogue!.types.find((t) => t.label === 'Deal')!;
    expect(deal.custom!.map((c) => c.currency)).toEqual(['USD', 'EUR']);
    expect(
      applyCardTypeChanges(
        defaultCatalogue(),
        [{ op: 'add', name: 'X', custom: [{ name: 'V', kind: 'currency', currency: 'pounds' }] }],
        statuses,
      ).ok,
    ).toBe(false);
  });

  it('is kept by the catalogue, a malformed code refused', () => {
    const ok = validateItemTypeCatalogue({ version: ITEM_TYPE_CATALOGUE_VERSION, types: [DEAL] });
    expect(ok.ok && ok.catalogue.types[0]!.custom![0]!.currency).toBe('USD');
    const bad = { ...DEAL, custom: [{ ...DEAL.custom![0]!, currency: 'usd' }, DEAL.custom![1]!] };
    expect(
      validateItemTypeCatalogue({ version: ITEM_TYPE_CATALOGUE_VERSION, types: [bad] }).ok,
    ).toBe(false);
  });
});

describe('Email', () => {
  it('keeps an address, trimmed, and refuses anything else', () => {
    expect(resolveFields({ Contact: '  sam@acme.co.uk ' }, DEAL, naming)).toMatchObject({
      ok: true,
      fields: { 'f-contact': 'sam@acme.co.uk' },
    });
    for (const bad of ['sam', 'sam@acme', 'a b@c.d', `${'x'.repeat(250)}@a.bc`])
      expect(resolveFields({ Contact: bad }, DEAL, naming), bad).toMatchObject({
        ok: false,
        code: 'value_invalid',
      });
    expect(isEmailAddress('a@b.co')).toBe(true);
    expect(customFieldText(DEAL.custom![1]!, 'sam@acme.co.uk')).toBe('sam@acme.co.uk');
  });
});
