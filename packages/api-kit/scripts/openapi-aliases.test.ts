import { describe, expect, it } from 'vitest';
import { inlineGenericAliases } from './openapi-aliases.mjs';

const generic = { type: 'object', properties: { from: { $ref: '#/definitions/ElementLink' } } };

describe('inlineGenericAliases', () => {
  it('folds a generic instance into its alias and points every ref at the alias', () => {
    const out = inlineGenericAliases({
      ArrowElement: { $ref: '#/definitions/ArrowElementOf%3CElementLink%3E' },
      'ArrowElementOf<ElementLink>': generic,
      Element: {
        anyOf: [{ $ref: '#/definitions/ArrowElementOf%3CElementLink%3E' }, { type: 'null' }],
      },
      ElementLink: { type: 'string' },
    });
    expect(out).toEqual({
      ArrowElement: generic,
      Element: { anyOf: [{ $ref: '#/definitions/ArrowElement' }, { type: 'null' }] },
      ElementLink: { type: 'string' },
    });
  });

  it("keeps the alias's description, and a second alias refers to the first", () => {
    const out = inlineGenericAliases({
      A: { $ref: '#/definitions/G<X>', description: 'An arrow.' },
      B: { $ref: '#/definitions/G<X>' },
      'G<X>': generic,
    });
    expect(out).toEqual({
      A: { ...generic, description: 'An arrow.' },
      B: { $ref: '#/definitions/A' },
    });
  });

  it('leaves plain refs, refs with siblings, and a generic it was not given alone', () => {
    const input = {
      Plain: { $ref: '#/definitions/Other' },
      Sibling: { $ref: '#/definitions/G<X>', nullable: true },
      Missing: { $ref: '#/definitions/H<Y>' },
      Empty: null,
      Other: { type: 'number' },
      'G<X>': generic,
    };
    expect(inlineGenericAliases(input)).toEqual(input);
  });
});
