import { describe, expect, it } from 'vitest';
import { formText } from './oauth-form';

describe('formText', () => {
  it('reads a string field, and anything else as empty', () => {
    const form = { a: 'x', file: new File(['1'], 'f.txt'), many: ['y', 'z'] };
    expect(formText(form, 'a')).toBe('x');
    expect(formText(form, 'file')).toBe('');
    expect(formText(form, 'many')).toBe('');
    expect(formText(form, 'missing')).toBe('');
  });
});
