// The item verbs (docs/specs/026-plan/plan-mode.md "Agents"): list, add, set, move and remove the items a
// document's Plan boards show, through the item store's routes (docs/specs/026-plan/items.md). An item is
// named by its key ("#12") or an id prefix (resolveItemRef), as people say it.

import { z } from 'zod';
import {
  itemStatus,
  itemSummary,
  itemTitle,
  resolveItem,
  type Item,
  type ItemFields,
} from '@livediagram/items';
import { defineVerb, VerbRefusal, type VerbContext } from '../define';
import { applyItemChanges, type ItemChange } from '../plan/item-changes';
import { FIELD_HINT } from '../plan/api-refusal';
import { planListing, resolveListingFilter } from '../plan/plan-listing';
import { readPlanState, type PlanState } from '../plan/plan-state';
import { columns, documentOf } from './shared';

const docArg = z.string().describe('A name, id prefix or livediagram URL');
const itemArg = z.string().describe('The item, by its number (#12) or an id prefix');

const itemOut = z.object({
  id: z.string(),
  key: z.number(),
  type: z.string(),
  status: z.string().nullable(),
  title: z.string(),
  fields: z.record(z.string(), z.unknown()),
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
  doc: string,
): Promise<{ documentId: string; state: PlanState }> {
  const document = await documentOf(ctx, doc);
  return { documentId: document.id, state: await readPlanState(ctx.api, document.id) };
}

// One change through the Plan engine (docs/specs/026-plan/plan-agents.md): names resolved as the MCP resolves
// them, a refusal as the verb's.
async function changeOne(ctx: VerbContext, doc: string, change: ItemChange): Promise<Item> {
  const { documentId, state } = await planOf(ctx, doc);
  const result = await applyItemChanges(ctx.api, documentId, [change], state);
  if (result.refusal)
    throw new VerbRefusal({
      status: 400,
      code: result.refusal.code,
      message: result.refusal.message,
      hint: 'list the columns, card types and fields with: livediagram item ls <doc>',
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

const lineOut = z.object({ item: itemOut, text: z.string() });

export const itemLs = defineVerb({
  id: 'item.ls',
  summary: 'The items of a document',
  description:
    'Lists the items Plan boards show: number, type, status and title, narrowed by type or status.',
  behaviour: 'read',
  input: z.object({
    doc: docArg,
    type: z.string().optional().describe('Only items of this type (task, note, project...)'),
    status: z.string().optional().describe('Only items with this status (a column)'),
  }),
  output: z.object({ items: z.array(itemOut), boards: z.array(z.string()) }),
  listKey: 'items',
  run: async (ctx, input) => {
    const { state } = await planOf(ctx, input.doc);
    const filter = resolveListingFilter(state, input);
    if (!filter.ok)
      throw new VerbRefusal({
        status: 400,
        code: filter.code,
        message: filter.message,
        hint: 'list the columns and card types with: livediagram item ls <doc>',
      });
    const listing = planListing(state, filter);
    const keys = new Map(state.items.map((i) => [i.id, i.key]));
    // A board's line: its title and each column with its card count ("Sprint: To Do 2 · Done 1").
    const boards = listing.boards.map(
      (b) => `${b.title}: ${b.columns.map((c) => `${c.name} ${c.cards.length}`).join(' · ')}`,
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
      })),
    };
  },
  text: ({ items, boards }) => [
    ...boards,
    ...columns(items.map((i) => [`#${i.key}`, i.type, i.status ?? '-', JSON.stringify(i.title)])),
  ],
  quiet: ({ items }) => items.map((i) => `#${i.key}`),
  cli: {
    positionals: ['doc'],
    examples: [
      'livediagram item ls "Sprint 14"',
      'livediagram item ls 3f9c --type task --status new',
    ],
    prints: 'one item a line: #number, type, status, title',
  },
});

export const itemAdd = defineVerb({
  id: 'item.add',
  summary: 'Add an item',
  description:
    'Makes an item in a document, at the end of its status column: a title, a type and any fields as key=value.',
  behaviour: 'write',
  input: z.object({
    doc: docArg,
    title: z.string().min(1).describe('The title'),
    type: z
      .string()
      .default('task')
      .describe('project, task, note, idea, action, or a type the document adds'),
    status: z.string().optional().describe('The column it starts in'),
    fields: z.array(z.string()).default([]).describe('More fields, as key=value'),
  }),
  output: lineOut,
  run: async (ctx, input) => {
    const item = await changeOne(ctx, input.doc, {
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
    positionals: ['doc', 'title'],
    examples: [
      'livediagram item add "Sprint 14" "Fix login" --type task --status todo --fields labels=bug',
      'livediagram item add 3f9c "Write the brief" --fields priority=high labels=docs',
    ],
    prints: '+ #<number> [<type>] <title>',
  },
});

export const itemSet = defineVerb({
  id: 'item.set',
  summary: 'Change an item',
  description: 'Sets fields of an item as key=value, clears fields by name, or changes its type.',
  behaviour: 'write',
  input: z.object({
    doc: docArg,
    item: itemArg,
    fields: z.array(z.string()).default([]).describe('Fields to set, as key=value'),
    clear: z.array(z.string()).default([]).describe('Fields to clear, by name'),
    type: z.string().optional().describe('A new type'),
  }),
  output: lineOut,
  run: async (ctx, input) => {
    const item = await changeOne(ctx, input.doc, {
      op: 'set',
      item: input.item,
      fields: fieldsFromPairs(input.fields),
      ...(input.clear.length ? { clear: input.clear } : {}),
      ...(input.type ? { type: input.type } : {}),
    });
    return { item: outOf(item), text: `~ ${itemSummary(item)}` };
  },
  text: ({ text }) => [text],
  quiet: ({ item }) => [`#${item.key}`],
  cli: {
    positionals: ['doc', 'item'],
    examples: [
      'livediagram item set "Sprint 14" "#12" --fields priority=urgent',
      'livediagram item set 3f9c 12 --clear due --type project',
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
    doc: docArg,
    item: itemArg,
    status: z.string().describe('The status (column) it moves to'),
    before: z.string().optional().describe('The item it lands before, by number or id prefix'),
  }),
  output: lineOut,
  run: async (ctx, input) => {
    const item = await changeOne(ctx, input.doc, {
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
    positionals: ['doc', 'item', 'status'],
    examples: [
      'livediagram item move "Sprint 14" "#12" done',
      'livediagram item move 3f9c 12 doing --before 9',
    ],
    prints: '→ #<number> [<type>] <title> in <status>',
  },
});

export const itemRm = defineVerb({
  id: 'item.rm',
  summary: 'Delete an item',
  description: 'Deletes an item from the document; its number is not used again.',
  behaviour: 'destructive',
  input: z.object({ doc: docArg, item: itemArg }),
  output: z.object({ id: z.string(), text: z.string() }),
  run: async (ctx, input) => {
    const { documentId, state } = await planOf(ctx, input.doc);
    const target = resolveItem(input.item, state.items);
    if (!target.ok)
      throw new VerbRefusal({
        status: 404,
        code: target.code,
        message: target.message,
        hint: 'list them with: livediagram item ls <doc>',
      });
    const id = target.item.id;
    const result = await applyItemChanges(ctx.api, documentId, [{ op: 'delete', item: id }], state);
    if (result.refusal)
      throw new VerbRefusal({
        status: 400,
        code: result.refusal.code,
        message: result.refusal.message,
        hint: 'list them with: livediagram item ls <doc>',
      });
    return { id, text: `- ${itemSummary(target.item)}` };
  },
  text: ({ text }) => [text],
  quiet: ({ id }) => [id],
  cli: {
    positionals: ['doc', 'item'],
    examples: ['livediagram item rm "Sprint 14" "#12"', 'livediagram item rm 3f9c 12'],
    prints: '- #<number> [<type>] <title>',
  },
});

export const itemVerbs = [itemLs, itemAdd, itemSet, itemMove, itemRm];
