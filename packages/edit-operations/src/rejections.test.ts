import { describe, expect, it } from 'vitest';
import { CHANGESET_MAX_OPERATIONS } from '@livediagram/api-schema';
import { checkoutFlow } from './fixtures/checkout-flow';
import {
  elementLocked,
  formatRejections,
  idTaken,
  invalidResult,
  invalidValue,
  parseError,
  tabLocked,
  tooLarge,
  unknownField,
  unknownOperation,
} from './rejections';

const elements = checkoutFlow().elements;
const byId = (id: string) => elements.find((el) => el.id === id)!;

describe('formatRejections', () => {
  it('prints the spec example character for character', () => {
    const text = formatRejections([
      {
        code: 'target_ambiguous',
        operation: 2,
        op: 'set "Pay" fill=green',
        details: [
          '"Pay" matches 3 elements:',
          '  n7  square "Pay" in f2',
          '  n9  sticky "Pay"',
          '  a4  arrow n3→n7 "Pay"',
        ],
        hint: 'use a ref, narrow with type:square, or add all',
      },
    ]);
    expect(text.join('\n')).toBe(
      [
        'error target_ambiguous · op 2 · set "Pay" fill=green',
        '  "Pay" matches 3 elements:',
        '    n7  square "Pay" in f2',
        '    n9  sticky "Pay"',
        '    a4  arrow n3→n7 "Pay"',
        '  hint: use a ref, narrow with type:square, or add all',
        'nothing was applied',
      ].join('\n'),
    );
  });

  it('prints a parse error by its line and column, and several rejections in one block', () => {
    expect(
      formatRejections([
        {
          code: 'parse_error',
          line: 3,
          column: 7,
          details: ['line 3, column 7: expected a value'],
        },
        { code: 'too_large', details: ['501 operations; the cap is 500'] },
      ]),
    ).toEqual([
      'error parse_error · line 3',
      '  line 3, column 7: expected a value',
      'error too_large',
      '  501 operations; the cap is 500',
      'nothing was applied',
    ]);
  });
});

describe('rejection builders', () => {
  it('too_large names the count and the cap', () => {
    expect(tooLarge(CHANGESET_MAX_OPERATIONS + 1)).toEqual({
      code: 'too_large',
      details: [`501 operations; the cap is ${CHANGESET_MAX_OPERATIONS}`],
      hint: 'split it into several changesets, or send a replace',
    });
  });

  it('unknown_operation names the vocabulary and the nearest name', () => {
    expect(unknownOperation('sett', 1)).toEqual({
      code: 'unknown_operation',
      operation: 1,
      details: [
        '"sett" is not an operation',
        'operations: add set rm move connect rewire insert wrap unwrap order layout test',
      ],
      hint: 'did you mean set?',
    });
    expect(unknownOperation('paint', 1).hint).toBeUndefined();
  });

  it('parse_error names the member', () => {
    expect(parseError(2, 'member "fields": expected an object')).toEqual({
      code: 'parse_error',
      operation: 2,
      details: ['member "fields": expected an object'],
    });
  });

  it('unknown_field names the kind, its fields and the nearest one', () => {
    const rejection = unknownField(1, 'arrow', 'labl', ['id', 'label', 'from']);
    expect(rejection).toEqual({
      code: 'unknown_field',
      operation: 1,
      details: ['arrow has no field "labl"', 'fields: id label from'],
      hint: 'did you mean label?',
    });
    expect(unknownField(1, 'arrow', 'zzzz', ['id']).hint).toBeUndefined();
  });

  it('invalid_value names the key, value and rule', () => {
    expect(invalidValue(1, 'id', 'n9', 'cannot be changed')).toEqual({
      code: 'invalid_value',
      operation: 1,
      details: ['id="n9": cannot be changed'],
    });
    expect(invalidValue(1, 'responses', [], 'a live field', 'ask people').hint).toBe('ask people');
    const long = Array.from({ length: 30 }, (_, i) => i);
    expect(invalidValue(1, 'cells', long, 'rows').details[0]).toBe(
      'cells=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,…: rows',
    );
  });

  it('id_taken names the holder and a free id', () => {
    const taken = new Set(['n3', 'n3-2']);
    expect(idTaken(1, byId('n3'), taken)).toEqual({
      code: 'id_taken',
      operation: 1,
      details: ['id "n3" is taken by square "Login"'],
      hint: 'use id n3-3',
    });
    expect(idTaken(1, byId('a1'), taken).details).toEqual(['id "a1" is taken by arrow']);
  });

  it('element_locked names the tab, or each element and why', () => {
    expect(tabLocked()).toEqual({
      code: 'element_locked',
      details: ['the tab is locked'],
      hint: 'unlock it in the editor, or leave it out of the changeset',
    });
    expect(elementLocked(2, byId('n3'), { scope: 'layer', layer: 'Base' }).details).toEqual([
      'locked:',
      '  n3  square "Login" (layer "Base")',
    ]);
    expect(elementLocked(2, byId('n3'), { scope: 'element' }).details[1]).toBe(
      '  n3  square "Login" (element)',
    );
  });

  it('invalid_result names the element, field and rule', () => {
    expect(invalidResult('x', 'shape', { field: 'x', rule: 'a finite number' })).toEqual({
      code: 'invalid_result',
      details: ['x x: a finite number'],
      hint: 'see the format: livediagram schema shape',
    });
    expect(invalidResult('the tab', undefined, { field: 'elements', rule: 'unique ids' })).toEqual({
      code: 'invalid_result',
      details: ['the tab elements: unique ids'],
      hint: 'see the format: livediagram schema',
    });
  });
});
