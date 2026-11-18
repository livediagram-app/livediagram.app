// The item verbs (docs/specs/026-plan/plan-mode.md "Agents"): list, add, set, move and remove the items a
// project's Plan boards show, through the item store's routes (docs/specs/026-plan/items.md). An item is
// named by its key ("#12") or an id prefix (resolveItemRef), as people say it.

import { z } from 'zod';
import {
  itemStatus,
  itemSummary,
  itemTitle,
  itemAssistantOf,
  FLAGGED_FIELD,
  resolveItem,
  type Item,
  type ItemFields,
  cardRefOrKey,
  type ItemTypeDef,
} from '@liveplanner/items';
import { defineVerb, VerbRefusal, type VerbContext } from '../define';
import { applyItemChanges, type ItemChange } from '../plan/item-changes';
import { FIELD_HINT } from '../plan/api-refusal';
import { pictureLinkFor } from '../plan/card-pictures';
import { listedPullRequestSchema, pullRequestLine } from '../plan/card-pull-requests';
import { keptListItems, resolveListItemsPage } from '../plan/list-items-page';
import {
  itemLister,
  listedBoards,
  NO_BOARD_HINT,
  resolveListingFilter,
} from '../plan/plan-listing';
import { readPlanState, type PlanState } from '../plan/plan-state';
import { handedToOf } from '../plan/assistant-caller';
import { columns, projectOf } from './shared';

const projectArg = z.string().describe('A name, id prefix or liveplanner URL');
const itemArg = z.string().describe('The item, by its number (#12) or an id prefix');

const itemOut = z.object({
  id: z.string(),
  key: z.number(),
  // Its number as people see it, with its type's prefix ("WI-12"; docs/specs/026-plan/item-types.md "Card number
  // prefixes"); every form reads back as the card.
  ref: z.string(),
  type: z.string(),
  status: z.string().nullable(),
  title: z.string(),
  fields: z.record(z.string(), z.unknown()),
});

// A card's linked pull requests with a state, as list_items lists them (docs/specs/026-plan/github-pull-requests.md
// "Agents").
const listedItemOut = itemOut.extend({
  pullRequests: z.array(listedPullRequestSchema).optional(),
  // The AI assistant it is handed to, by name (docs/specs/026-plan/plan-agents.md "Cards handed to an assistant").
  assistant: z.string().optional(),
});

const outOf = (item: Item, types: readonly ItemTypeDef[]) => ({
  id: item.id,
  key: item.key,
  ref: cardRefOrKey(item, types),
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
async function changeOne(
  ctx: VerbContext,
  projectRef: string,
  change: ItemChange,
): Promise<{ item: Item; types: readonly ItemTypeDef[] }> {
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
  return { item: result.touched[0]!, types: state.plan.types };
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

// The words `item ls` prints after its cards when it left closed ones out: list_items' note in the CLI's flags.
export function closedLeftOutLine(closed: number): string {
  return (
    `${closed} closed card${closed === 1 ? '' : 's'} (in a done column such as Done or Cancelled, trashed or ` +
    'archived) left out: add --include-closed to list them, or name their column with --status.'
  );
}

export const itemLs = defineVerb({
  id: 'item.ls',
  summary: 'The items of a plan',
  description:
    'Lists the items Plan boards show: number, type, status and title, narrowed by types, columns, text or when ' +
    'they changed. Every card is listed unless --query or --updated-since is given; then, as list_items does, a ' +
    'closed card (in a done column, trashed or archived) is left out unless --include-closed is, or --status names ' +
    'its column.',
  behaviour: 'read',
  input: z.object({
    project: projectArg,
    type: z
      .array(z.string())
      .optional()
      .describe('Only items of this type (task, note, project...); repeat for several'),
    status: z
      .array(z.string())
      .optional()
      .describe('Only items in this status (a column); repeat for several'),
    query: z
      .string()
      .optional()
      .describe('Only items whose title or description holds this text, ignoring case'),
    updatedSince: z
      .string()
      .optional()
      .describe(
        'Only items changed at or after this ISO date or time (2026-11-01, 2026-11-01T09:00:00Z)',
      ),
    includeClosed: z
      .boolean()
      .optional()
      .describe('With --query or --updated-since, list closed items too'),
    handedToMe: z.boolean().optional().describe("Only items handed to this token's assistant"),
  }),
  output: z.object({
    items: z.array(listedItemOut),
    boards: z.array(z.string()),
    closedLeftOut: z.number().optional(),
  }),
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
    // list_items' narrowing (Work Tracker 913), read as it reads it. Every card stays listed, closed ones too, unless
    // a text or time filter asks for list_items' open-cards answer, so a script that ran item ls before still works.
    const narrowed = input.query !== undefined || input.updatedSince !== undefined;
    const page = resolveListItemsPage({
      query: input.query,
      updatedSince: input.updatedSince,
      includeClosed: input.includeClosed === true || !narrowed,
    });
    if (!page.ok)
      throw new VerbRefusal({
        status: 400,
        code: page.code,
        message: page.message.replace('updatedSince', '--updated-since'),
        hint: 'for example: liveplanner item ls <project> --updated-since 2026-11-01',
      });
    // Only the cards handed to this token's assistant, when asked.
    const handed = await handedToOf(ctx.api, state.items, input.handedToMe);
    if (!handed.ok)
      throw new VerbRefusal({
        status: 400,
        code: handed.code,
        message: handed.message,
        hint: 'sign in with an AI tool or a named API token: liveplanner auth login',
      });
    const { kept, closed, closedOut } = keptListItems(state, filter, {
      ...page,
      ...(handed.handedTo ? { handedTo: handed.handedTo } : {}),
    });
    // Each picture with a link the CLI's token reads (docs/specs/015-api/cli.md "Pictures").
    const lister = itemLister(state, pictureLinkFor(ctx.host, projectId));
    const listed = listedBoards(state, { closedOut });
    // A board's line: its title and each column with its card count, a done column ticked, then its header widgets
    // ("Sprint: To Do 2 · Done ✓ 1 | Widgets: Item Count, Filter").
    const boards = listed.boards.map(
      (b) =>
        `${b.title}: ${b.columns.map((c) => `${c.name}${c.done ? ' ✓' : ''} ${c.cards.length}`).join(' · ')}` +
        (b.widgets?.length ? ` | Widgets: ${b.widgets.join(', ')}` : ''),
    );
    return {
      boards: state.plan.boards.length === 0 ? [NO_BOARD_HINT] : boards,
      items: kept.map((item) => {
        const i = lister(item);
        const assistant = itemAssistantOf(item);
        return {
          id: i.id,
          key: item.key,
          ref: i.ref,
          type: i.type,
          status: i.column ?? i.status,
          title: i.title,
          fields: i.fields,
          ...(i.pullRequests ? { pullRequests: i.pullRequests } : {}),
          ...(assistant ? { assistant: assistant.name } : {}),
        };
      }),
      ...(closed > 0 ? { closedLeftOut: closed } : {}),
    };
  },
  // A card's linked pull requests end its line: "acme/web#42 open, checks failing; acme/api#7 merged".
  text: ({ items, boards, closedLeftOut }) => [
    ...boards,
    ...columns(
      items.map((i) => [
        i.ref,
        i.type,
        i.status ?? '-',
        JSON.stringify(i.title) +
          (i.fields[FLAGGED_FIELD] === true ? '  flagged' : '') +
          (i.assistant ? `  → ${i.assistant}` : '') +
          (i.pullRequests?.length ? `  ${i.pullRequests.map(pullRequestLine).join('; ')}` : ''),
      ]),
    ),
    ...(closedLeftOut ? [closedLeftOutLine(closedLeftOut)] : []),
  ],
  quiet: ({ items }) => items.map((i) => i.ref),
  cli: {
    positionals: ['project'],
    examples: [
      'liveplanner item ls 3f9c --status "To Do" --status Doing --type bug --type task',
      'liveplanner item ls "Sprint 14" --updated-since 2026-11-01 --handed-to-me',
    ],
    prints:
      'one item a line: #number, type, status, title, flagged on a flagged card, its AI assistant, then its pull ' +
      'requests with their states',
  },
});

export const itemAdd = defineVerb({
  id: 'item.add',
  summary: 'Add an item',
  description:
    'Makes an item in a plan, at the end of its status column: a title, a type and any fields as key=value, ' +
    'or a card template of its type to start from (--template), whose title it takes when none is given.',
  behaviour: 'write',
  input: z.object({
    project: projectArg,
    title: z.string().min(1).optional().describe('The title (optional with --template)'),
    type: z
      .string()
      .default('task')
      .describe('project, task, note, idea, action, or a type the plan adds'),
    status: z.string().optional().describe('The column it starts in'),
    fields: z.array(z.string()).default([]).describe('More fields, as key=value'),
    template: z
      .string()
      .optional()
      .describe('A card template of its type to start from, by name or id (type ls lists them)'),
  }),
  output: lineOut,
  run: async (ctx, input) => {
    const { item, types } = await changeOne(ctx, input.project, {
      op: 'add',
      ...(input.title ? { title: input.title } : {}),
      type: input.type,
      ...(input.status ? { status: input.status } : {}),
      fields: fieldsFromPairs(input.fields),
      ...(input.template ? { template: input.template } : {}),
    });
    return { item: outOf(item, types), text: `+ ${itemSummary(item, types)}` };
  },
  text: ({ text }) => [text],
  quiet: ({ item }) => [item.ref],
  cli: {
    positionals: ['project', 'title'],
    examples: [
      'liveplanner item add "Sprint 14" "Fix login" --type task --status todo --fields labels=bug',
      'liveplanner item add 3f9c --type bug --template "Bug Report" --fields priority=high',
    ],
    prints: '+ #<number> [<type>] <title>',
  },
});

export const itemSet = defineVerb({
  id: 'item.set',
  summary: 'Change an item',
  description:
    'Sets fields of an item as key=value, clears fields by name, or changes its type. flagged=true flags it, ' +
    'flagged=false or --clear flagged unflags it. An Image field or attachments ' +
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
    const { item, types } = await changeOne(ctx, input.project, {
      op: 'set',
      item: input.item,
      fields: withPictureRemovals(fieldsFromPairs(input.fields), input.remove),
      ...(input.clear.length ? { clear: input.clear } : {}),
      ...(input.type ? { type: input.type } : {}),
    });
    return { item: outOf(item, types), text: `~ ${itemSummary(item, types)}` };
  },
  text: ({ text }) => [text],
  quiet: ({ item }) => [item.ref],
  cli: {
    positionals: ['project', 'item'],
    examples: [
      'liveplanner item set "Sprint 14" "#12" --fields priority=urgent flagged=true',
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
    const { item, types } = await changeOne(ctx, input.project, {
      op: 'move',
      item: input.item,
      status: input.status,
      ...(input.before ? { before: input.before } : {}),
    });
    return { item: outOf(item, types), text: `→ ${itemSummary(item, types)} in ${input.status}` };
  },
  text: ({ text }) => [text],
  quiet: ({ item }) => [item.ref],
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
    return { id, text: `- ${itemSummary(target.item, state.plan.types)}` };
  },
  text: ({ text }) => [text],
  quiet: ({ id }) => [id],
  cli: {
    positionals: ['project', 'item'],
    examples: ['liveplanner item rm "Sprint 14" "#12"', 'liveplanner item rm 3f9c 12'],
    prints: '- #<number> [<type>] <title>',
  },
});

// Hands a card this token's assistant holds back to its person (plan-agents.md "Cards handed to an assistant").
export const itemHandBack = defineVerb({
  id: 'item.hand-back',
  summary: 'Hand an item back',
  description:
    "Hands an item handed to this token's AI assistant back to the person it works for: its assignee becomes " +
    'them. Refused for an item not handed to it. Take one with: item set <project> <item> --fields assignee=me.',
  behaviour: 'write',
  input: z.object({ project: projectArg, item: itemArg }),
  output: lineOut,
  run: async (ctx, input) => {
    const { item, types } = await changeOne(ctx, input.project, {
      op: 'hand_back',
      item: input.item,
    });
    const person = item.fields['assignee'];
    const named =
      person && typeof person === 'object' && 'name' in person ? person.name : undefined;
    const name = typeof named === 'string' ? named : 'its person';
    return {
      item: outOf(item, types),
      text: `~ ${itemSummary(item, types)} handed back to ${name}`,
    };
  },
  text: ({ text }) => [text],
  quiet: ({ item }) => [item.ref],
  cli: {
    positionals: ['project', 'item'],
    examples: [
      'liveplanner item hand-back "Sprint 14" "#12"',
      'liveplanner item hand-back 3f9c 12',
    ],
    prints: '~ #<number> [<type>] <title> handed back to <person>',
  },
});

export const itemVerbs = [itemLs, itemAdd, itemSet, itemMove, itemRm, itemHandBack];
