import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { fieldsOf, flagOf, keyOf, restName } from './fields';

// A verb's input as its flags, for an example verb. Each product's CLI suite runs it again over its own verbs.
describe('fieldsOf', () => {
  it('reads each key’s kind, whether it is required, its description and its values', () => {
    const input = z.object({
      name: z.string().describe('The name.'),
      count: z.number().optional().describe('How many.'),
      force: z.boolean().default(false),
      kind: z.enum(['a', 'b']).optional(),
      tab: z.array(z.string()),
    });

    expect(fieldsOf(input)).toEqual([
      { key: 'name', kind: 'string', required: true, description: 'The name.' },
      { key: 'count', kind: 'number', required: false, description: 'How many.' },
      { key: 'force', kind: 'boolean', required: false, description: '' },
      { key: 'kind', kind: 'enum', required: false, description: '', values: ['a', 'b'] },
      { key: 'tab', kind: 'list', required: true, description: '' },
    ]);
  });
});

describe('fieldsOf descriptions', () => {
  it('keeps a description written before .optional() or .default()', () => {
    const input = z.object({
      before: z.string().describe('Before optional.').optional(),
      after: z.string().optional().describe('After optional.'),
      defaulted: z.number().describe('Before default.').default(3),
      both: z.string().describe('Inner.').optional().describe('Outer.'),
    });
    expect(fieldsOf(input).map((f) => f.description)).toEqual([
      'Before optional.',
      'After optional.',
      'Before default.',
      'Outer.',
    ]);
  });
});

describe('flags and positionals', () => {
  it('spells a camelCase key as a kebab-case flag', () => {
    expect(flagOf('tabId')).toBe('--tab-id');
  });

  it('reads `...name` as the rest of the words', () => {
    expect(restName('...text')).toBe('text');
    expect(restName('id')).toBeNull();
    expect(keyOf('...text')).toBe('text');
    expect(keyOf('id')).toBe('id');
  });
});
