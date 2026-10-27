// The board verb (docs/specs/026-plan/plan-agents.md "Adding a board"): `board add` puts a Plan board on a tab,
// from a preset or columns by name, through the Plan engine the MCP's add_board shares.
import { z } from 'zod';
import { PLAN_BOARD_PRESET_IDS } from '@liveplanner/items';
import { defineVerb, VerbRefusal } from '../define';
import { addBoard } from '../plan/add-board';
import { changeBoard, EVERY_TYPE } from '../plan/change-board';
import { projectOf } from './shared';

const csv = (v: string | undefined) =>
  v
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const boardAdd = defineVerb({
  id: 'board.add',
  summary: 'Add a Plan board',
  description:
    'Puts a Plan board on a tab, beside what it holds: a preset, or columns by name. A column named like one the plan already has shares it.',
  behaviour: 'write',
  input: z.object({
    project: z.string().describe('A name, id prefix or liveplanner URL'),
    tab: z
      .string()
      .optional()
      .describe('The tab id, a tab in Plan; the first tab with a board, else the first tab'),
    preset: z
      .enum(PLAN_BOARD_PRESET_IDS)
      .optional()
      .describe('A ready-made board (default kanban)'),
    title: z.string().optional().describe('The board title'),
    columns: z.string().optional().describe('Column names, comma separated, left to right'),
    types: z.string().optional().describe('The card types it takes, comma separated'),
  }),
  output: z.object({
    tabId: z.string(),
    elementId: z.string(),
    title: z.string(),
    columns: z.array(z.object({ name: z.string(), status: z.string() })),
  }),
  run: async (ctx, input) => {
    const project = await projectOf(ctx, input.project);
    const columns = csv(input.columns);
    const types = csv(input.types);
    const result = await addBoard(
      ctx.api,
      project.id,
      {
        ...(input.tab ? { tabId: input.tab } : {}),
        ...(input.preset ? { preset: input.preset } : {}),
        ...(input.title ? { title: input.title } : {}),
        ...(columns ? { columns } : {}),
        ...(types ? { types } : {}),
      },
      'cli',
    );
    if (!result.ok)
      throw new VerbRefusal({
        status: 400,
        code: result.code,
        message: result.message,
        hint: 'presets: ' + PLAN_BOARD_PRESET_IDS.join(', '),
      });
    return {
      tabId: result.tabId,
      elementId: result.elementId,
      title: result.title,
      columns: result.columns,
    };
  },
  text: ({ title, columns }) => [
    `+ board ${JSON.stringify(title)}: ${columns.map((c) => c.name).join(' · ')}`,
  ],
  quiet: ({ elementId }) => [elementId],
  cli: {
    positionals: ['project'],
    examples: [
      'liveplanner board add "Sprint 14" --preset sprint',
      'liveplanner board add 3f9c --columns "Ideas,Doing,Shipped" --title Roadmap --types project',
    ],
    prints: '+ board "<title>": <column> · <column> ...',
  },
});

export const boardSet = defineVerb({
  id: 'board.set',
  summary: 'Change a Plan board',
  description:
    "Changes a board's title, its columns (every column by name: names it has keep their cards) or the card types it takes.",
  behaviour: 'write',
  input: z.object({
    project: z.string().describe('A name, id prefix or liveplanner URL'),
    board: z.string().describe('The board, by title or element id'),
    title: z.string().optional().describe('A new title'),
    columns: z.string().optional().describe('Every column, comma separated, left to right'),
    types: z
      .string()
      .optional()
      .describe('The card types it takes, comma separated; "all" for every type'),
    done: z
      .string()
      .optional()
      .describe(
        'The columns whose cards count as done, comma separated; "none" for no done column',
      ),
  }),
  output: z.object({
    elementId: z.string(),
    title: z.string(),
    columns: z.array(
      z.object({ name: z.string(), status: z.string(), done: z.literal(true).optional() }),
    ),
    takes: z.union([z.array(z.string()), z.literal('every type')]),
  }),
  run: async (ctx, input) => {
    const project = await projectOf(ctx, input.project);
    const columns = csv(input.columns);
    const types = input.types?.trim().toLowerCase() === 'all' ? EVERY_TYPE : csv(input.types);
    const doneColumns = input.done?.trim().toLowerCase() === 'none' ? [] : csv(input.done);
    const result = await changeBoard(
      ctx.api,
      project.id,
      {
        board: input.board,
        ...(input.title ? { title: input.title } : {}),
        ...(columns ? { columns } : {}),
        ...(types ? { types } : {}),
        ...(doneColumns ? { doneColumns } : {}),
      },
      'cli',
    );
    if (!result.ok)
      throw new VerbRefusal({
        status: result.code === 'board_unknown' ? 404 : 400,
        code: result.code,
        message: result.message,
        hint: 'list the boards with: liveplanner item ls <project>',
      });
    return {
      elementId: result.elementId,
      title: result.title,
      columns: result.columns,
      takes: result.takes,
    };
  },
  text: ({ title, columns, takes }) => [
    `~ board ${JSON.stringify(title)}: ${columns.map((c) => `${c.name}${c.done ? ' ✓' : ''}`).join(' · ')} (takes ${
      takes === 'every type' ? takes : takes.length ? takes.join(', ') : 'no type'
    })`,
  ],
  quiet: ({ elementId }) => [elementId],
  cli: {
    positionals: ['project', 'board'],
    examples: [
      'liveplanner board set "Sprint 14" Kanban --types Task,Bug',
      'liveplanner board set 3f9c Roadmap --columns "Now,Next,Later,Done" --done "Done, Later"',
    ],
    prints: '~ board "<title>": <column> · <done column> ✓ ... (takes <types>)',
  },
});

export const boardVerbs = [boardAdd, boardSet];
