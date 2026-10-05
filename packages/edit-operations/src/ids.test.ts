import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { checkoutFlow, fixedIds } from './fixtures/checkout-flow';
import { newElementId } from './ids';
import { createState, putElement, removeElement } from './state';

const state = () => createState(checkoutFlow(), { makeId: fixedIds() }, () => {});
const sticky = (id: string) => ({ id, type: 'sticky', x: 0, y: 0, width: 1, height: 1 }) as Element;

describe('newElementId (EO8, EO9)', () => {
  it('slugs the label, or the kind for an unlabelled element, free among taken ids and keywords', () => {
    const s = state();
    expect(newElementId(s, { label: 'Verify email', kind: 'square' }, 1)).toBe('verify-email');
    expect(newElementId(s, { kind: 'arrow' }, 1)).toBe('arrow');
    expect(newElementId(s, { label: 'Frame', kind: 'frame' }, 1)).toBe('frame-2');
    putElement(s, sticky('verify-email'), 1);
    expect(newElementId(s, { label: 'Verify email', kind: 'square' }, 1)).toBe('verify-email-2');
    expect(newElementId(s, { label: 'N3', kind: 'square' }, 1)).toBe('n3-2');
  });

  it('takes a free slug id, refusing a bad, keyword or taken one', () => {
    const s = state();
    expect(newElementId(s, { given: 'verify', kind: 'square' }, 1)).toBe('verify');
    expect(newElementId(s, { given: 'Verify', kind: 'square' }, 1)).toMatchObject({
      code: 'invalid_value',
    });
    expect(newElementId(s, { given: 'between', kind: 'square' }, 1)).toMatchObject({
      code: 'invalid_value',
    });
    expect(newElementId(s, { given: 'n3', kind: 'square' }, 2)).toMatchObject({
      code: 'id_taken',
      operation: 2,
    });
    putElement(s, sticky('temp'), 1);
    removeElement(s, 'temp', 1, {});
    expect(newElementId(s, { given: 'temp', kind: 'square' }, 1)).toMatchObject({
      code: 'invalid_value',
      details: ['id="temp": used by an element this changeset removed'],
    });
  });
});
