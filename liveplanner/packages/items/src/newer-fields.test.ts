import { describe, expect, it } from 'vitest';
import { ITEM_TYPES } from './item-types';
import { isNewerField, NEWER_FIELD_MAX_BYTES, readNewerField } from './newer-fields';
import { readItemTypeCatalogue, validateItemTypeCatalogue } from './type-catalogue';
import { missingRequiredFields, requiredCustomFieldsOf } from './required-fields';
import { formulaScopeOf } from './formula/references';

// docs/specs/026-plan/item-types.md "Fields from a newer version": a field of a kind (or a calculation) this build
// does not know is kept as stored, read-only, never a reason to refuse the catalogue.
const signature = {
  id: 'f-signature',
  label: 'Signed By',
  kind: 'signature',
  pen: { colour: '#0f172a', width: 2 },
  required: true,
  onCard: true,
};
const forecast = {
  id: 'f-forecast',
  label: 'Forecast',
  kind: 'calculated',
  calculation: 'forecast',
  horizon: 30,
};
const contract = {
  id: 'contract',
  label: 'Contract',
  color: '#0891b2',
  glyph: 'chat',
  fields: ['title', 'status', 'f-signature', 'f-amount', 'f-forecast'],
  custom: [signature, { id: 'f-amount', label: 'Amount', kind: 'number' }, forecast],
};
const stored = { version: 1, types: [...ITEM_TYPES, contract] };

const contractOf = (catalogue: { types: readonly { id: string }[] }) =>
  catalogue.types.find((t) => t.id === 'contract') as typeof contract;

describe('isNewerField', () => {
  it('is every kind this build lacks, and a Calculated field of a calculation it lacks', () => {
    expect(isNewerField({ kind: 'text' })).toBe(false);
    expect(isNewerField({ kind: 'calculated', calculation: 'formula' })).toBe(false);
    expect(isNewerField({ kind: 'signature' as never })).toBe(true);
    expect(isNewerField({ kind: 'calculated', calculation: 'forecast' as never })).toBe(true);
    expect(isNewerField({ kind: 'calculated' })).toBe(true);
  });
});

describe('readNewerField', () => {
  it('copies everything stored, its checked id and label written back', () => {
    const read = readNewerField(
      { ...signature, label: '  Signed By ' },
      'f-signature',
      'Signed By',
    );
    expect(read).toEqual(signature);
    expect(read).not.toBe(signature);
  });

  it('refuses one too large, or one that cannot be copied', () => {
    const big = { ...signature, notes: 'x'.repeat(NEWER_FIELD_MAX_BYTES) };
    expect(readNewerField(big, signature.id, signature.label)).toBeNull();
    expect(readNewerField({ ...signature, n: 1n }, signature.id, signature.label)).toBeNull();
  });
});

describe('a catalogue holding newer fields', () => {
  it('opens, each newer field kept exactly as stored', () => {
    const read = readItemTypeCatalogue(JSON.stringify(stored));
    expect(read).not.toBeNull();
    const type = contractOf(read!);
    expect(type.custom).toEqual(contract.custom);
    expect(type.fields).toEqual(contract.fields);
  });

  it('survives a save round trip untouched, a change to another field and all', () => {
    const first = validateItemTypeCatalogue(stored);
    if (!first.ok) throw new Error(first.reason);
    // The type editor renames the known field and saves: the newer ones go back as they came.
    const changed = {
      ...first.catalogue,
      types: first.catalogue.types.map((t) =>
        t.id === 'contract'
          ? {
              ...t,
              custom: t.custom!.map((f) => (f.id === 'f-amount' ? { ...f, label: 'Total' } : f)),
            }
          : t,
      ),
    };
    const again = validateItemTypeCatalogue(JSON.parse(JSON.stringify(changed)));
    if (!again.ok) throw new Error(again.reason);
    const custom = contractOf(again.catalogue).custom;
    expect(custom[0]).toEqual(signature);
    expect(custom[2]).toEqual(forecast);
    expect(custom[1]).toEqual({ id: 'f-amount', label: 'Total', kind: 'number' });
  });

  it('is refused on a write that asks for it, naming the kind or the calculation', () => {
    expect(validateItemTypeCatalogue(stored, { newerFields: 'refuse' })).toEqual({
      ok: false,
      reason: `types[${ITEM_TYPES.length}].custom[0].kind`,
    });
    const onlyForecast = { ...contract, custom: [forecast], fields: ['f-forecast'] };
    expect(
      validateItemTypeCatalogue({ version: 1, types: [onlyForecast] }, { newerFields: 'refuse' }),
    ).toEqual({ ok: false, reason: 'types[0].custom[0].calculation' });
  });

  it('still refuses a kind that is no kind, and a newer field past its size', () => {
    const withField = (field: object) => ({
      version: 1,
      types: [{ ...contract, fields: ['f-signature'], custom: [field] }],
    });
    expect(validateItemTypeCatalogue(withField({ ...signature, kind: '' }))).toMatchObject({
      reason: 'types[0].custom[0].kind',
    });
    expect(
      validateItemTypeCatalogue(
        withField({ ...signature, notes: 'x'.repeat(NEWER_FIELD_MAX_BYTES) }),
      ),
    ).toMatchObject({ reason: 'types[0].custom[0].kind' });
    expect(
      validateItemTypeCatalogue(
        withField({ ...forecast, notes: 'x'.repeat(NEWER_FIELD_MAX_BYTES) }),
      ),
    ).toMatchObject({ reason: 'types[0].custom[0].calculation' });
  });

  it('never makes a newer field required here, and a formula never reads one', () => {
    const read = validateItemTypeCatalogue(stored);
    if (!read.ok) throw new Error(read.reason);
    const type = contractOf(read.catalogue);
    expect(requiredCustomFieldsOf(type)).toEqual([]);
    expect(missingRequiredFields(type, {})).toEqual([]);
    const scope = formulaScopeOf(type);
    expect(scope.byId.has('f-signature')).toBe(false);
    expect(scope.byId.has('f-forecast')).toBe(false);
    expect(scope.byId.has('f-amount')).toBe(true);
    expect(scope.unreadable.get('signed by')).toBe(
      "A field from a newer version of liveplanner can't be used in a formula",
    );
  });
});
