// The item verbs (docs/specs/026-plan/plan-mode.md "Agents"): list, add, set, move and remove the items a
// project's Plan boards show, through the item store's routes (docs/specs/026-plan/items.md). An item is
// named by its key ("#12") or an id prefix (resolveItemRef), as people say it.

import { z } from 'zod';
import {
  itemStatus,
  itemSummary,
  itemTitle,
  resolveItem,
  type Item,
  type ItemFields,
} from '@liveplanner/items';
import { defineVerb, VerbRefusal, type VerbContext } from '../define';
import { applyItemChanges, type ItemChange } from '../plan/item-changes';
import { FIELD_HINT } from '../plan/api-refusal';
import { pictureLinkFor } from '../plan/card-pictures';
import { listedPullRequestSchema, pullRequestLine } from '../plan/card-pull-requests';
import { planListing, resolveListingFilter } from '../plan/plan-listing';
import { readPlanState, type PlanState } from '../plan/plan-state';
import { columns, projectOf } from './shared';

const projectArg = z.string().describe('A name, id prefix or liveplanner URL');
const itemArg = z.string().describe('The item, by its number (#12) or an id prefix');

const itemOut = z.object({
  id: z.string(),
  key: z.number(),
  type: z.string(),
  status: z.string().nullable(),
  title: z.string(),
  fields: z.record(z.string(), z.unknown()),
});

// A card's linked pull requests with a state, as list_items lists them (docs/specs/026-plan/github-pull-requests.md
// "Agents").
const listedItemOut = itemOut.extend({
  pullRequests: z.array(listedPullRequestSchema).optional(),
});

const outOf = (item: Item) => ({
  id: item.id,
  key: item.key,
  type: item.type,
  status: itemStatus(item) ?? null,
  title: itemTitle(item),
  fields: item.fields as Record<string, unknown>,
});

async function planOf(
  ctx: VerbContext,
  projectRef: string,
): Promise<{ projectId: string; state: PlanState }> {
  const project = await projectOf(ctx, projectRef);
  return { projectId: project.id, state: await readPlanState(ctx.api, project.id) };
}

// One change through the Plan engine (docs/specs/026-plan/plan-agents.md): names resolved as the MCP resolves
// them, a refusal as the verb's.
async function changeOne(ctx: VerbContext, projectRef: string, change: ItemChange): Promise<Item> {
  const { projectId, state } = await planOf(ctx, projectRef);
  const result = await applyItemChanges(ctx.api, projectId, [change], state);
  if (result.refusal)
    throw new VerbRefusal({
      status: 400,
      code: result.refusal.code,
      message: result.refusal.message,
      hint: 'list the columns, card types and fields with: liveplanner item ls <project>',
    });
  // An add, set or move that was not refused always answers its item.
  return result.touched[0]!;
}

// `key=value` pairs into fields: numbers stay numbers, `labels` splits on commas, the rest is text.
export function fieldsFromPairs(pairs: readonly string[]): ItemFields {
  const fields: ItemFields = {};
  for (const pair of pairs) {
    const at = pair.indexOf('=');
    if (at < 1)
      throw new VerbRefusal({
        status: 400,
        code: 'usage',
        message: `expected key=value, got ${JSON.stringify(pair)}`,
        hint: `for example: priority=high labels=ux,api estimate=3. ${FIELD_HINT}`,
      });
    const key = pair.slice(0, at);
    const raw = pair.slice(at + 1);
    fields[key] =
      key === 'labels'
        ? raw
            .split(',')
            .map((l) => l.trim())
            .filter(Boolean)
        : key === 'estimate' && /^\d+(\.\d+)?$/.test(raw)
          ? Number(raw)
          : raw;
  }
  return fields;
}

// `--remove key=id,id` into `fields`: the pictures to take off an Image field or Attachments (docs/specs/015-api/cli.md
// "Pictures"), beside any the same key adds.
export function withPictureRemovals(fields: ItemFields, pairs: readonly string[]): ItemFields {
  const out: Record<string, unknown> = { ...fields };
  for (const [key, raw] of Object.entries(fieldsFromPairs(pairs))) {
    // fieldsFromPairs gives text, a number (estimate) or a list (labels).
    const remove = (Array.isArray(raw) ? (raw as string[]).join(',') : `${raw as string | number}`)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    out[key] = { ...(key in fields ? { add: fields[key] } : {}), remove };
  }
  return out as ItemFields;
}

const lineOut = z.object({ item: itemOut, text: z.string() });

export const itemLs = defineVerb({
  id: 'item.ls',
  summary: 'The items of a plan',
  description:
    'Lists the items Plan boards show: number, type, status and title, narrowed by type or status.',
  behaviour: 'read',
  input: z.object({
    project: projectArg,
    type: z.string().optional().describe('Only items of this type (task, note, project...)'),
    status: z.string().optional().describe('Only items with this status (a column)'),
  }),
  output: z.object({ items: z.array(listedItemOut), boards: z.array(z.string()) }),
  listKey: 'items',
  run: async (ctx, input) => {
    const { projectId, state } = await planOf(ctx, input.project);
    const filter = resolveListingFilter(state, input);
    if (!filter.ok)
      throw new VerbRefusal({
        status: 400,
        code: filter.code,
        message: filter.message,
        hint: 'list the columns and card types with: liveplanner item ls <project>',
      });
    // Each picture with a link the CLI's token reads (docs/specs/015-api/cli.md "Pictures").
    const listing = planListing(state, filter, pictureLinkFor(ctx.host, projectId));
    const keys = new Map(state.items.map((i) => [i.id, i.key]));
    // A board's line: its title and each column with its card count, a done column ticked, then its header widgets
    // ("Sprint: To Do 2 · Done ✓ 1 | Widgets: Item Count, Filter").
    const boards = listing.boards.map(
      (b) =>
        `${b.title}: ${b.columns.map((c) => `${c.name}${c.done ? ' ✓' : ''} ${c.cards.length}`).join(' · ')}` +
        (b.widgets?.length ? ` | Widgets: ${b.widgets.join(', ')}` : ''),
    );
    return {
      boards: listing.hint ? [listing.hint] : boards,
      items: listing.items.map((i) => ({
        id: i.id,
        key: keys.get(i.id)!,
        type: i.type,
        status: i.column ?? i.status,
        title: i.title,
        fields: i.fields,
        ...(i.pullRequests ? { pullRequests: i.pullRequests } : {}),
      })),
    };
  },
  // A card's linked pull requests end its line: "acme/web#42 open, checks failing; acme/api#7 merged".
  text: ({ items, boards }) => [
    ...boards,
    ...columns(
      items.map((i) => [
        `#${i.key}`,
        i.type,
        i.status ?? '-',
        JSON.stringify(i.title) +
          (i.pullRequests?.length ? `  ${i.pullRequests.map(pullRequestLine).join('; ')}` : ''),
      ]),
    ),
  ],
  quiet: ({ items }) => items.map((i) => `#${i.key}`),
  cli: {
    positionals: ['project'],
    examples: [
      'liveplanner item ls "Sprint 14"',
      'liveplanner item ls 3f9c --type task --status new',
    ],
    prints:
      'one item a line: #number, type, status, title, then its pull requests with their states',
  },
});

export const itemAdd = defineVerb({
  id: 'item.add',
  summary: 'Add an item',
  description:
    'Makes an item in a plan, at the end of its status column: a title, a type and any fields as key=value.',
  behaviour: 'write',
  input: z.object({
    project: projectArg,
    title: z.string().min(1).describe('The title'),
    type: z
      .string()
      .default('task')
      .describe('project, task, note, idea, action, or a type the plan adds'),
    status: z.string().optional().describe('The column it starts in'),
    fields: z.array(z.string()).default([]).describe('More fields, as key=value'),
  }),
  output: lineOut,
  run: async (ctx, input) => {
    const item = await changeOne(ctx, input.project, {
      op: 'add',
      title: input.title,
      type: input.type,
      ...(input.status ? { status: input.status } : {}),
      fields: fieldsFromPairs(input.fields),
    });
    return { item: outOf(item), text: `+ ${itemSummary(item)}` };
  },
  text: ({ text }) => [text],
  quiet: ({ item }) => [`#${item.key}`],
  cli: {
    positionals: ['project', 'title'],
    examples: [
      'liveplanner item add "Sprint 14" "Fix login" --type task --status todo --fields labels=bug',
      'liveplanner item add 3f9c "Write the brief" --fields priority=high labels=docs',
    ],
    prints: '+ #<number> [<type>] <title>',
  },
});

export const itemSet = defineVerb({
  id: 'item.set',
  summary: 'Change an item',
  description:
    'Sets fields of an item as key=value, clears fields by name, or changes its type. An Image field or attachments ' +
    'takes picture ids from image add (key=<id>, several as a comma list, added at the end); --remove takes them off.',
  behaviour: 'write',
  input: z.object({
    project: projectArg,
    item: itemArg,
    fields: z.array(z.string()).default([]).describe('Fields to set, as key=value'),
    clear: z
      .array(z.string())
      .default([])
      .describe('Fields to clear, by name (a field that holds several also clears with key=)'),
    remove: z
      .array(z.string())
      .default([])
      .describe(
        'Pictures to take off an Image field or attachments, as key=<id> (a comma list too)',
      ),
    type: z.string().optional().describe('A new type'),
  }),
  output: lineOut,
  run: async (ctx, input) => {
    const item = await changeOne(ctx, input.project, {
      op: 'set',
      item: input.item,
      fields: withPictureRemovals(fieldsFromPairs(input.fields), input.remove),
      ...(input.clear.length ? { clear: input.clear } : {}),
      ...(input.type ? { type: input.type } : {}),
    });
    return { item: outOf(item), text: `~ ${itemSummary(item)}` };
  },
  text: ({ text }) => [text],
  quiet: ({ item }) => [`#${item.key}`],
  cli: {
    positionals: ['project', 'item'],
    examples: [
      'liveplanner item set "Sprint 14" "#12" --fields priority=urgent',
      'liveplanner item set 3f9c 12 --clear due --type project',
    ],
    prints: '~ #<number> [<type>] <title>',
  },
});

export const itemMove = defineVerb({
  id: 'item.move',
  summary: 'Move an item to a column',
  description:
    "Moves an item to a status (a board's column), at the end of it or before another item.",
  behaviour: 'write',
  input: z.object({
    project: projectArg,
    item: itemArg,
    status: z.string().describe('The status (column) it moves to'),
    before: z.string().optional().describe('The item it lands before, by number or id prefix'),
  }),
  output: lineOut,
  run: async (ctx, input) => {
    const item = await changeOne(ctx, input.project, {
      op: 'move',
      item: input.item,
      status: input.status,
      ...(input.before ? { before: input.before } : {}),
    });
    return { item: outOf(item), text: `→ ${itemSummary(item)} in ${input.status}` };
  },
  text: ({ text }) => [text],
  quiet: ({ item }) => [`#${item.key}`],
  cli: {
    positionals: ['project', 'item', 'status'],
    examples: [
      'liveplanner item move "Sprint 14" "#12" done',
      'liveplanner item move 3f9c 12 doing --before 9',
    ],
    prints: '→ #<number> [<type>] <title> in <status>',
  },
});

export const itemRm = defineVerb({
  id: 'item.rm',
  summary: 'Delete an item',
  description: 'Deletes an item from the plan; its number is not used again.',
  behaviour: 'destructive',
  input: z.object({ project: projectArg, item: itemArg }),
  output: z.object({ id: z.string(), text: z.string() }),
  run: async (ctx, input) => {
    const { projectId, state } = await planOf(ctx, input.project);
    const target = resolveItem(input.item, state.items);
    if (!target.ok)
      throw new VerbRefusal({
        status: 404,
        code: target.code,
        message: target.message,
        hint: 'list them with: liveplanner item ls <project>',
      });
    const id = target.item.id;
    const result = await applyItemChanges(ctx.api, projectId, [{ op: 'delete', item: id }], state);
    if (result.refusal)
      throw new VerbRefusal({
        status: 400,
        code: result.refusal.code,
        message: result.refusal.message,
        hint: 'list them with: liveplanner item ls <project>',
      });
    return { id, text: `- ${itemSummary(target.item)}` };
  },
  text: ({ text }) => [text],
  quiet: ({ id }) => [id],
  cli: {
    positionals: ['project', 'item'],
    examples: ['liveplanner item rm "Sprint 14" "#12"', 'liveplanner item rm 3f9c 12'],
    prints: '- #<number> [<type>] <title>',
  },
});

export const itemVerbs = [itemLs, itemAdd, itemSet, itemMove, itemRm];
