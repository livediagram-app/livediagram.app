// The Plan tools' input and output shapes (docs/specs/026-plan/plan-agents.md, docs/specs/015-api/mcp-server.md
// §4.9b): list_items, change_items, add_board and change_card_types. Everything is named as people name it (a
// column name, a card type's name, a custom field's name, a person's name, "#12"); the server resolves the ids.
import { z } from 'zod';
import { CUSTOM_FIELD_KINDS, PLAN_BOARD_PRESET_IDS, PLAN_TYPE_COLOURS } from '@livediagram/items';

const url = z.string().describe('Link that opens the document in the livediagram editor.');
const documentId = z.string().describe('The document (from find_documents).');
const itemRef = z.string().describe('The item, by its number ("#12") or an id prefix.');
const statusArg = z
  .string()
  .describe(
    'A column, by its name as the board shows it ("In Progress"), case aside. list_items lists them.',
  );
const typeArg = z
  .string()
  .describe(
    'A card type, by name or id ("Task", "bug"). list_items lists the document’s card types.',
  );

const fieldsArg = z
  .record(z.string(), z.unknown())
  .describe(
    'Fields by name: description, status (a column name), assignee (a person’s name, e.g. "Sam"), priority ' +
      '(urgent|high|medium|low), labels (["seo","copy"] or "seo, copy"), estimate (0-999), start and due ' +
      '(YYYY-MM-DD), color (a #rrggbb colour, e.g. ' +
      PLAN_TYPE_COLOURS.slice(0, 4).join(' ') +
      '), checklist [{text,done}], parent ("#12", a Project), and the card type’s custom fields by name ' +
      '("Severity": "S2"; a Card field takes "#12"). A field the card type lacks is refused: add it with ' +
      'change_card_types.',
  );

export const listItemsShape = {
  documentId,
  type: typeArg.optional().describe('Only items of this card type, by name or id.'),
  status: statusArg.optional().describe('Only items in this column, by name or status.'),
};

const itemChange = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('add'),
    title: z.string().min(1),
    type: typeArg.default('task'),
    status: statusArg
      .optional()
      .describe(
        'The column it starts in, at the end, by name. Left out, it waits off every board.',
      ),
    fields: fieldsArg.optional(),
  }),
  z.object({
    op: z.literal('set'),
    item: itemRef,
    fields: fieldsArg.optional(),
    clear: z.array(z.string()).optional().describe('Fields to clear, by name (never title).'),
    type: typeArg.optional().describe('Change its card type.'),
  }),
  z.object({
    op: z.literal('move'),
    item: itemRef,
    status: statusArg.describe('The column it moves to, by name; it moves there on every board.'),
    before: itemRef
      .optional()
      .describe('The item it lands before; the end of the column when absent.'),
  }),
  z.object({ op: z.literal('delete'), item: itemRef }),
]);

export const changeItemsShape = {
  documentId,
  changes: z
    .array(itemChange)
    .min(1)
    .max(50)
    .describe('Applied in order; each sees the ones before it. A refused change stops the rest.'),
};

export const addBoardShape = {
  documentId,
  tabId: z
    .string()
    .optional()
    .describe('The tab to put it on; defaults to the first tab with a board, else the first tab.'),
  preset: z
    .enum(PLAN_BOARD_PRESET_IDS)
    .optional()
    .describe(
      'A ready-made board: its columns, card fields and widgets. Defaults to kanban (blank with columns).',
    ),
  title: z.string().optional().describe('The board’s title.'),
  columns: z
    .array(z.string())
    .min(1)
    .max(12)
    .optional()
    .describe(
      'Column names, left to right, replacing the preset’s. A name the document’s boards already use shares ' +
        'their column, so its cards show here too.',
    ),
  types: z
    .array(z.string())
    .optional()
    .describe(
      'The card types it shows and takes, by name or id. Absent: the preset’s (todo takes Actions, roadmap ' +
        'Projects, sprint Stories, Tasks and Bugs...; the answer says), or every type for columns by name. A ' +
        'preset’s Bug or Story the document lacks is added to its card types.',
    ),
};

export const changeBoardShape = {
  documentId,
  board: z
    .string()
    .describe('The board, by its title, or its id when two share a title (list_items lists them).'),
  title: z.string().optional().describe('A new title.'),
  columns: z
    .array(z.string())
    .min(1)
    .max(12)
    .optional()
    .describe(
      'Every column, by name, left to right. A name the board has keeps its column and cards; a name other ' +
        'boards use shares their column; any other name is a new, empty column. A column left out leaves its ' +
        'cards off this board.',
    ),
  types: z
    .array(z.string())
    .optional()
    .describe('The card types it shows and takes, by name; an empty list shows every type.'),
};

const customField = z.object({
  name: z.string().min(1).describe('The field’s name, as cards show it ("Severity").'),
  kind: z
    .enum(CUSTOM_FIELD_KINDS)
    .describe('text, longtext, number, date, checkbox, link, choice, or card.'),
  options: z
    .array(z.string())
    .optional()
    .describe('A choice field’s options, in order (up to 20).'),
  linkType: typeArg.optional().describe('A card field’s target card type.'),
  onCard: z.boolean().optional().describe('Draw it on the card face.'),
});

const colourArg = z
  .string()
  .describe(`A #rrggbb colour, e.g. ${PLAN_TYPE_COLOURS.slice(0, 4).join(' ')}.`);
const glyphArg = z.string().describe('A Plan glyph id (task, bug, story, epic, star, flag...).');
const builtInFields = z
  .array(z.string())
  .describe(
    'Built-in fields by name: description, assignee, priority, labels, estimate, start, due, checklist, parent, color.',
  );

export const cardTypeChangeSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('add'),
    name: z.string().min(1).describe('The new card type’s name ("Bug"); its id is made from it.'),
    color: colourArg.optional(),
    glyph: glyphArg.optional(),
    fields: builtInFields
      .optional()
      .describe('Its built-in fields after Title and Status; default Description, Assignee.'),
    custom: z.array(customField).optional().describe('Its custom fields.'),
    defaultStatus: statusArg
      .optional()
      .describe('The column a card of it starts in when none is given.'),
    excludedStatuses: z
      .array(z.string())
      .optional()
      .describe('Columns, by name, its cards never move into.'),
  }),
  z.object({
    op: z.literal('set'),
    type: typeArg,
    name: z.string().optional().describe('A new name (its id never changes).'),
    color: colourArg.optional(),
    glyph: glyphArg.optional(),
    addFields: builtInFields.optional(),
    removeFields: builtInFields
      .optional()
      .describe('Built-in fields to remove; values stay on the cards.'),
    addCustom: z.array(customField).optional(),
    removeCustom: z
      .array(z.string())
      .optional()
      .describe('Custom fields to remove, by name; values stay.'),
    defaultStatus: statusArg
      .nullable()
      .optional()
      .describe('The Default State, or null to clear it.'),
    excludedStatuses: z
      .array(z.string())
      .optional()
      .describe('Columns, by name, its cards never move into.'),
  }),
  z.object({
    op: z.literal('delete'),
    type: typeArg.describe(
      'The card type to delete; its cards move to the Trash, as in the editor.',
    ),
  }),
  z.object({
    op: z
      .literal('add_default_types')
      .describe(
        'Adds any of Project, Task, Note, Idea and Action the document lacks; changes none it has.',
      ),
  }),
  z.object({
    op: z.literal('restore_built_ins').describe('The older name of add_default_types.'),
  }),
]);

export const changeCardTypesShape = {
  documentId,
  changes: z
    .array(cardTypeChangeSchema)
    .min(1)
    .max(32)
    .describe('Applied in order and saved together; one refused change saves none.'),
};

// --- Outputs ---

const listedCustom = z.object({
  id: z.string().describe('The field id items store it under ("f-severity").'),
  name: z.string().describe('The field’s name, as change_items takes it.'),
  kind: z.string().describe('text, longtext, number, date, checkbox, link, choice or card.'),
  options: z.array(z.string()).optional().describe('A choice field’s options.'),
  linkType: z.string().optional().describe('A card field’s target card type id.'),
});

const listedType = z.object({
  id: z.string().describe('The card type id ("task", "bug").'),
  name: z.string().describe('The name boards show ("Task").'),
  fields: z.array(z.string()).describe('Its built-in fields.'),
  custom: z.array(listedCustom).describe('Its custom fields.'),
});

const listedBoard = z.object({
  title: z.string().describe('The board’s title.'),
  tab: z.string().describe('The tab it is on.'),
  tabId: z.string().describe('That tab’s id (add_board’s tabId).'),
  kind: z
    .enum(['board', 'all-cards', 'archive'])
    .describe('board files cards by column; all-cards and archive show cards by what they are.'),
  takes: z
    .union([z.array(z.string()), z.literal('every type')])
    .describe('The card types it shows.'),
  columns: z
    .array(
      z.object({
        name: z.string().describe('The column name: what status takes.'),
        status: z.string().describe('The status id items store.'),
        wipLimit: z.number().optional().describe('The most cards the column should hold.'),
        cards: z.array(z.string()).describe('The cards in it, top to bottom ("#3").'),
      }),
    )
    .describe('Left to right.'),
});

const listedItem = z.object({
  ref: z.string().describe('The item’s number as people say it, "#12".'),
  id: z.string().describe('The item id.'),
  type: z.string().describe('Its card type id.'),
  status: z.string().nullable().describe('Its status id, or null.'),
  column: z
    .string()
    .nullable()
    .describe('The name of the column its status is, or null when on no board.'),
  title: z.string().describe('The title.'),
  fields: z
    .record(z.string(), z.unknown())
    .describe(
      'Every field, title and status included; custom fields by their names, as change_items takes them.',
    ),
});

export const listItemsOutput = {
  boards: z.array(listedBoard).describe('The Plan boards, in tab then canvas order.'),
  notOnBoard: z.array(z.string()).describe('Cards no board column shows.'),
  count: z.number().describe('How many items are listed.'),
  items: z.array(listedItem).describe('The items, by number.'),
  types: z.array(listedType).describe('The document’s card types.'),
  hint: z.string().optional().describe('What to do when the document has no board.'),
  url,
};

export const changeItemsOutput = {
  applied: z
    .array(z.string())
    .describe('One line per change, naming the column: + added, ~ changed, → moved, - deleted.'),
  url,
};

export const addBoardOutput = {
  tabId: z.string().describe('The tab it was put on.'),
  elementId: z.string().describe('The board element id.'),
  title: z.string().describe('The board’s title.'),
  columns: z
    .array(
      z.object({
        name: z.string().describe('The column name: what change_items takes.'),
        status: z.string().describe('The status id items store.'),
      }),
    )
    .describe('Its columns, left to right.'),
  takes: z
    .union([z.array(z.string()), z.literal('every type')])
    .describe('The card types it shows: a card of another type is saved but no board shows it.'),
  brought: z
    .array(z.string())
    .describe(
      'Card types the board brought into the document, by name (a bug-triage board brings Bug when the ' +
        'document lacks it); empty when it had them all.',
    ),
  changesetId: z.string().nullable().describe('The changeset that added it (revertible).'),
  rev: z.number().nullable().describe('The tab revision after it.'),
  url,
};

export const changeBoardOutput = {
  tabId: z.string().describe('The tab it is on.'),
  elementId: z.string().describe('The board element id.'),
  title: z.string().describe('The board’s title.'),
  columns: z
    .array(
      z.object({
        name: z.string().describe('The column name: what change_items takes.'),
        status: z.string().describe('The status id items store.'),
      }),
    )
    .describe('Its columns now, left to right.'),
  takes: z
    .union([z.array(z.string()), z.literal('every type')])
    .describe('The card types it shows now.'),
  changesetId: z.string().nullable().describe('The changeset that changed it (revertible).'),
  rev: z.number().nullable().describe('The tab revision after it.'),
  url,
};

export const changeCardTypesOutput = {
  applied: z.array(z.string()).describe('One line per change, with the ids it made.'),
  trashed: z.array(z.string()).describe('Cards moved to the Trash with a deleted type.'),
  types: z.array(listedType).describe('The card types now.'),
  url,
};
