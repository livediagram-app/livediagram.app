// The card type verbs (docs/specs/026-plan/plan-agents.md "Changing card types"): `type ls` lists a project's card
// types with their fields, `type apply` applies changes from a JSON file (the MCP's change_card_types changes),
// through the Plan engine the MCP shares.
import { z } from 'zod';
import { defineVerb, VerbRefusal } from '../define';
import { cardTypeChangeSchema } from '../mcp/plan-schema';
import { changeCardTypes } from '../plan/card-types';
import { listedTypes } from '../plan/plan-listing';
import { readPlanState } from '../plan/plan-state';
import { columns, projectOf } from './shared';

const projectArg = z.string().describe('A name, id prefix or liveplanner URL');

const typeOut = z.object({
  id: z.string(),
  name: z.string(),
  fields: z.array(z.string()),
  custom: z.array(
    z
      .object({
        id: z.string(),
        name: z.string(),
        kind: z.string(),
        calculation: z.string().optional(),
      })
      .passthrough(),
  ),
});

export const typeLs = defineVerb({
  id: 'type.ls',
  summary: 'The card types of a plan',
  description:
    'Lists the card types its boards hold: id, name, built-in fields and custom fields with their ids; a ' +
    'required custom field is marked with *.',
  behaviour: 'read',
  input: z.object({ project: projectArg }),
  output: z.object({ types: z.array(typeOut) }),
  listKey: 'types',
  run: async (ctx, input) => {
    const project = await projectOf(ctx, input.project);
    const { plan } = await readPlanState(ctx.api, project.id);
    return { types: listedTypes(plan.types, plan.statuses) };
  },
  text: ({ types }) =>
    columns(
      types.map((t) => [
        t.id,
        JSON.stringify(t.name),
        [
          ...t.fields,
          ...t.custom.map(
            (f) =>
              `${f.name}${f.required ? '*' : ''}:${f.kind}${f.calculation ? `=${f.calculation}` : ''} (${f.id})`,
          ),
        ].join(', '),
      ]),
    ),
  quiet: ({ types }) => types.map((t) => t.id),
  cli: {
    positionals: ['project'],
    examples: ['liveplanner type ls "Sprint 14"', 'liveplanner type ls 3f9c --json'],
    prints: 'one type a line: id, name, fields (a required custom field marked *)',
  },
});

// The file's JSON, or undefined when it is not JSON (refused as not a list of changes).
function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export const typeApply = defineVerb({
  id: 'type.apply',
  summary: 'Change card types from a file',
  description:
    'Applies card type changes from a JSON file (or stdin, with -f -): an array of add, set, delete and add_default_types changes, checked and saved together.',
  behaviour: 'destructive',
  input: z.object({
    project: projectArg,
    file: z.string().describe('The JSON file, or - for stdin'),
  }),
  output: z.object({ applied: z.array(z.string()), trashed: z.array(z.string()) }),
  run: async (ctx, input) => {
    const parsed = z
      .array(cardTypeChangeSchema)
      .min(1)
      .safeParse(jsonOf(await ctx.readInput(input.file)));
    if (!parsed.success)
      throw new VerbRefusal({
        status: 400,
        code: 'usage',
        message: `the file is not a list of card type changes: ${parsed.error.issues[0]!.message}`,
        hint: 'for example: [{"op":"add","name":"Bug","custom":[{"name":"Severity","kind":"choice","options":["S1","S2"]}]}]',
      });
    const project = await projectOf(ctx, input.project);
    const result = await changeCardTypes(ctx.api, project.id, parsed.data);
    if (result.refusal)
      throw new VerbRefusal({
        status: 400,
        code: result.refusal.code,
        message: result.refusal.message,
        hint: 'list the card types with: liveplanner type ls <project>',
      });
    return { applied: result.applied, trashed: result.trashed };
  },
  text: ({ applied, trashed }) => [
    ...applied,
    ...(trashed.length ? [`moved to the Trash: ${trashed.join(' ')}`] : []),
  ],
  quiet: ({ applied }) => applied,
  cli: {
    positionals: ['project'],
    flags: { file: { short: 'f' } },
    examples: [
      'liveplanner type apply "Sprint 14" -f types.json',
      'echo \'[{"op":"delete","type":"Bug"}]\' | liveplanner type apply 3f9c -f -',
    ],
    prints: 'one line per change, with the ids it made',
  },
});

export const cardTypeVerbs = [typeLs, typeApply];
