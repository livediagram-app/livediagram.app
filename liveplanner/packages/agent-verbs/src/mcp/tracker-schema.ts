// import_board's input and output (docs/specs/026-plan/tracker-import.md "Agents", docs/specs/015-api/mcp-server.md
// §4.9b): another tool's export as text, read and mapped as the editor's Import dialog does.
import { z } from 'zod';
import { TRACKER_SOURCES } from '@liveplanner/items';

const url = z.string().describe('Link that opens the plan in the liveplanner editor.');

export const importBoardShape = {
  content: z
    .string()
    .describe(
      'The export file’s text: a Trello board’s JSON (Menu, Print and export, Export as JSON), or an Asana project, ' +
        'Jira issues or Linear issues CSV export. Up to 20 MB and 2,000 cards.',
    ),
  fileName: z
    .string()
    .optional()
    .describe(
      'The file’s name: a CSV board is named after it (without its extension) unless name is given.',
    ),
  source: z
    .enum(TRACKER_SOURCES)
    .optional()
    .describe('The tool it came from; read from the file when left out (a mismatch is refused).'),
  projectId: z
    .string()
    .optional()
    .describe('The plan to add the Board tab to (from find_projects); a new plan when left out.'),
  name: z
    .string()
    .optional()
    .describe('The board’s (and a new plan’s) name, in place of the file’s.'),
  preview: z
    .boolean()
    .optional()
    .describe(
      'true: answer what the import would make (columns, fields, people, comments, what is left out) and write nothing.',
    ),
};

const count = z.object({
  reason: z.string().describe('Why it was left out.'),
  count: z.number().describe('How many.'),
});

export const importBoardOutput = {
  written: z.boolean().describe('Whether it imported (false for a preview).'),
  projectId: z
    .string()
    .nullable()
    .describe('The plan it went into (a new plan’s id); null for a preview of one.'),
  newPlan: z.boolean().describe('Whether it made (or would make) a new plan.'),
  tabId: z.string().nullable().describe('The new Board tab; null for a preview.'),
  title: z.string().describe('The board’s name.'),
  source: z.string().describe('The tool the file came from: Trello, Asana, Jira or Linear.'),
  columns: z
    .array(
      z.object({
        name: z.string().describe('The column name.'),
        cards: z.number().describe('Its cards.'),
      }),
    )
    .describe('The board’s columns, left to right, with their cards.'),
  fields: z
    .array(
      z.object({
        from: z.string().describe('The source’s field.'),
        to: z.string().describe('The card field it fills.'),
        isNew: z.boolean().describe('Whether the card type gains it as a new custom field.'),
        cards: z.number().describe('How many cards have it.'),
      }),
    )
    .describe('How the file’s fields map to card fields.'),
  cards: z.number().describe('The cards made (or that would be).'),
  comments: z.number().describe('The comments carried, in one Imported comments thread a card.'),
  people: z
    .object({
      onPlan: z.number().describe('Matched by name to someone already on the plan.'),
      named: z.number().describe('New named people.'),
    })
    .describe('People matched by name to someone on the plan, and new named people.'),
  leftOut: z.array(count).describe('What was left out, each reason with its count.'),
  fits: z
    .boolean()
    .describe(
      'Whether this plan has room for it all; false names the reason, and a new plan always fits.',
    ),
  reason: z.string().optional().describe('Why it would not fit this plan.'),
  summary: z
    .string()
    .describe('One line: "Imported 120 cards from Trello", or what a preview would make.'),
  url: url.nullable().describe('Link that opens the plan; null for a preview of a new plan.'),
};
