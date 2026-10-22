// What a verb's input fields are, read from its zod schema (blueprint "buildParseOptions"): each key's kind
// (flag type), whether it is required, and its description for help.

import type { z } from 'zod';

// A list is a flag given once per value (`--doc a --doc b`).
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
    for (
      let def = defOf(inner);
      def.type === 'optional' || def.type === 'default';
      def = defOf(inner)
    ) {
      required = false;
      inner = def.innerType!;
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
      description: schema.description ?? '',
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
