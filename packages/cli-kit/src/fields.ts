// What a verb's input fields are, read from its zod schema (each product's docs/specs/015-api/blueprints/cli.md
// "buildParseOptions"): each key's kind (flag type), whether it is required, and its description for help
// (written before or after `.optional()` / `.default()`).

import type { z } from 'zod';

// A list is a flag given once per value (`--tab a --tab b`).
export type FieldKind = 'string' | 'number' | 'boolean' | 'enum' | 'list';

export type Field = {
  key: string;
  kind: FieldKind;
  required: boolean;
  description: string;
  values?: string[];
};

type Def = { type: string; innerType?: z.ZodType; entries?: Record<string, string> };

const defOf = (schema: z.ZodType): Def => (schema as unknown as { _zod: { def: Def } })._zod.def;

export function fieldsOf(input: z.ZodObject): Field[] {
  const shape: Record<string, z.ZodType> = input.shape;
  return Object.entries(shape).map(([key, schema]) => {
    let inner = schema;
    let required = true;
    // The outermost description wins, wherever it was written: `.describe()` before `.optional()` lands on the
    // inner schema, after it on the wrapper.
    let description = schema.description;
    for (
      let def = defOf(inner);
      def.type === 'optional' || def.type === 'default';
      def = defOf(inner)
    ) {
      required = false;
      inner = def.innerType!;
      description ??= inner.description;
    }
    const def = defOf(inner);
    const kind: FieldKind =
      def.type === 'boolean'
        ? 'boolean'
        : def.type === 'number'
          ? 'number'
          : def.type === 'array'
            ? 'list'
            : def.type === 'enum'
              ? 'enum'
              : 'string';
    return {
      key,
      kind,
      required,
      description: description ?? '',
      ...(def.entries ? { values: Object.values(def.entries) } : {}),
    };
  });
}

// `--kebab-case` of a camelCase key.
export const flagOf = (key: string) => `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

// A positional written `...name` takes every remaining word.
export const restName = (positional: string) =>
  positional.startsWith('...') ? positional.slice(3) : null;
export const keyOf = (positional: string) => restName(positional) ?? positional;
