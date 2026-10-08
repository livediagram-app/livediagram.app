// The card type verbs (docs/specs/026-plan/plan-agents.md "Changing card types"): `type ls` lists a document's card
// types with their fields, `type apply` applies changes from a JSON file (the MCP's change_card_types changes),
// through the Plan engine the MCP shares.
import { z } from 'zod';
import { defineVerb, VerbRefusal } from '../define';
import { cardTypeChangeSchema } from '../mcp/plan-schema';
import { changeCardTypes } from '../plan/card-types';
import { listedType } from '../plan/plan-listing';
import { readPlanState } from '../plan/plan-state';
import { columns, documentOf } from './shared';

const docArg = z.string().describe('A name, id prefix or livediagram URL');

const typeOut = z.object({
  id: z.string(),
  name: z.string(),
  fields: z.array(z.string()),
  custom: z.array(z.object({ id: z.string(), name: z.string(), kind: z.string() }).passthrough()),
});

export const typeLs = defineVerb({
  id: 'type.ls',
  summary: 'The card types of a document',
  description:
    'Lists the card types its boards hold: id, name, built-in fields and custom fields with their ids.',
  behaviour: 'read',
  input: z.object({ doc: docArg }),
  output: z.object({ types: z.array(typeOut) }),
  listKey: 'types',
  run: async (ctx, input) => {
    const document = await documentOf(ctx, input.doc);
    const { plan } = await readPlanState(ctx.api, document.id);
    return { types: plan.types.map(listedType) };
  },
  text: ({ types }) =>
    columns(
      types.map((t) => [
        t.id,
        JSON.stringify(t.name),
        [...t.fields, ...t.custom.map((f) => `${f.name}:${f.kind} (${f.id})`)].join(', '),
      ]),
    ),
  quiet: ({ types }) => types.map((t) => t.id),
  cli: {
    positionals: ['doc'],
    examples: ['livediagram type ls "Sprint 14"', 'livediagram type ls 3f9c --json'],
    prints: 'one type a line: id, name, fields',
  },
});

export const typeApply = defineVerb({
  id: 'type.apply',
  summary: 'Change card types from a file',
  description:
    'Applies card type changes from a JSON file (or stdin, with -f -): an array of add, set, delete and restore_built_ins changes, checked and saved together.',
  behaviour: 'destructive',
  input: z.object({ doc: docArg, file: z.string().describe('The JSON file, or - for stdin') }),
  output: z.object({ applied: z.array(z.string()), trashed: z.array(z.string()) }),
  run: async (ctx, input) => {
    const parsed = z
      .array(cardTypeChangeSchema)
      .min(1)
      .safeParse(JSON.parse(await ctx.readInput(input.file)));
    if (!parsed.success)
      throw new VerbRefusal({
        status: 400,
        code: 'usage',
        message: `the file is not a list of card type changes: ${parsed.error.issues[0]?.message ?? 'invalid'}`,
        hint: 'for example: [{"op":"add","name":"Bug","custom":[{"name":"Severity","kind":"choice","options":["S1","S2"]}]}]',
      });
    const document = await documentOf(ctx, input.doc);
    const result = await changeCardTypes(ctx.api, document.id, parsed.data);
    if (result.refusal)
      throw new VerbRefusal({
        status: 400,
        code: result.refusal.code,
        message: result.refusal.message,
        hint: 'list the card types with: livediagram type ls <doc>',
      });
    return { applied: result.applied, trashed: result.trashed };
  },
  text: ({ applied, trashed }) => [
    ...applied,
    ...(trashed.length ? [`moved to the Trash: ${trashed.join(' ')}`] : []),
  ],
  quiet: ({ applied }) => applied,
  cli: {
    positionals: ['doc'],
    flags: { file: { short: 'f' } },
    examples: [
      'livediagram type apply "Sprint 14" -f types.json',
      'echo \'[{"op":"delete","type":"Bug"}]\' | livediagram type apply 3f9c -f -',
    ],
    prints: 'one line per change, with the ids it made',
  },
});

export const cardTypeVerbs = [typeLs, typeApply];
