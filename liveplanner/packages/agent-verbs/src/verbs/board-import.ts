// `board import` (docs/specs/026-plan/tracker-import.md "Agents"): a Trello, Asana, Jira or Linear export made a Board
// tab of a plan, or a new plan, through the import engine the MCP's import_board shares, answering as it does.
import { z } from 'zod';
import { TRACKER_SOURCES } from '@liveplanner/items';
import { defineVerb, VerbRefusal } from '../define';
import { importBoardOutput } from '../mcp/tracker-schema';
import { importTrackerBoard, trackerImportAnswer } from '../plan/tracker-import';
import { projectOf } from './shared';

const plural = (n: number, one: string) =>
  `${n.toLocaleString('en-GB')} ${one}${n === 1 ? '' : 's'}`;

export const boardImport = defineVerb({
  id: 'board.import',
  summary: 'Import a board from another tool',
  description:
    'Makes a Board tab (or, with no --project, a new plan) from a Trello board JSON, or an Asana, Jira or Linear CSV export: its columns, its cards with their fields and comments, and a card type for them. --preview prints what it would make and writes nothing.',
  behaviour: 'write',
  input: z.object({
    file: z.string().describe('The export file, or - for stdin'),
    project: z
      .string()
      .optional()
      .describe(
        'The plan to add the Board tab to (a name, id prefix or URL); a new plan when omitted',
      ),
    from: z
      .enum(TRACKER_SOURCES)
      .optional()
      .describe('The tool it came from; read from the file when omitted'),
    name: z.string().optional().describe("The board's name, in place of the file's"),
    preview: z.boolean().optional().describe('Print what it would make, writing nothing'),
  }),
  output: z.object(importBoardOutput),
  run: async (ctx, input) => {
    const content = await ctx.readInput(input.file);
    const project = input.project ? await projectOf(ctx, input.project) : null;
    const fileName = input.file === '-' ? undefined : input.file.split(/[\\/]/).pop();
    const result = await importTrackerBoard(
      ctx.api,
      {
        content,
        ...(fileName ? { fileName } : {}),
        ...(input.from ? { source: input.from } : {}),
        ...(project ? { projectId: project.id } : {}),
        ...(input.name ? { name: input.name } : {}),
        ...(input.preview ? { preview: true } : {}),
      },
      'cli',
      ctx.newId,
    );
    if (!result.ok)
      throw new VerbRefusal({
        status: 400,
        code: result.code,
        message: result.message,
        hint: 'exports: a Trello board JSON, or an Asana, Jira or Linear CSV',
      });
    return trackerImportAnswer(
      result,
      result.projectId ? `${ctx.host}/project/${result.projectId}` : null,
    );
  },
  text: (out) => [
    `${out.written ? '+' : '?'} board ${JSON.stringify(out.title)} from ${out.source}: ${plural(out.cards, 'card')}, ${plural(out.columns.length, 'column')}`,
    ...out.leftOut.map((l) => `  left out: ${l.reason} (${l.count.toLocaleString('en-GB')})`),
    out.written ? out.url! : out.summary,
  ],
  quiet: ({ tabId }) => (tabId ? [tabId] : []),
  cli: {
    positionals: ['file'],
    examples: [
      'liveplanner board import trello-board.json --project "Sprint 14"',
      'liveplanner board import - --preview --from linear --name "Q4 issues" < issues.csv',
    ],
    prints: '+ board "<title>" from <Source>: <n> cards, <n> columns, then the link',
  },
});
