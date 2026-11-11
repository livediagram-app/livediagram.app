import { describe, expect, it } from 'vitest';
import { fieldClass, isDateOp, opTakesValue, opsFor } from './field-kinds';

describe('field-kinds', () => {
  it('classes a field by what it holds, text by default', () => {
    expect(fieldClass('number')).toBe('number');
    expect(fieldClass('date')).toBe('date');
    expect(fieldClass('labels')).toBe('list');
    expect(fieldClass('priority')).toBe('choice');
    expect(fieldClass('something-new')).toBe('text');
  });
  it('offers each class its comparisons', () => {
    expect(opsFor('date')).toContain('before');
    expect(opsFor('text')).not.toContain('before');
    expect(opTakesValue('empty')).toBe(false);
    expect(opTakesValue('is')).toBe(true);
    expect(isDateOp('on_or_after')).toBe(true);
    expect(isDateOp('is')).toBe(false);
  });
});
