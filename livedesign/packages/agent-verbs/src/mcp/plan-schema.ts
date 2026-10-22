// The Plan tools' input and output shapes (docs/specs/026-plan/plan-agents.md, docs/specs/015-api/mcp-server.md
// §4.9b): list_items, change_items, add_board and change_card_types. Everything is named as people name it (a
// column name, a card type's name, a custom field's name, a person's name, "#12"); the server resolves the ids.
import { z } from 'zod';
import {
  CUSTOM_FIELD_KINDS,
  PLAN_BOARD_PRESET_IDS,
  PLAN_GLYPH_IDS,
  PLAN_TYPE_COLOURS,
} from '@livepages/items';

const url = z.string().describe('Link that opens the document in the livepages editor.');
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
  type: typeArg
    .optional()
    .describe('Only items of this card type, by name or id; an unknown one is refused.'),
  status: statusArg
    .optional()
    .describe(
      'Only items in this column, by name or status ("Trash" for the Trash); an unknown one is refused.',
    ),
};

// Each change is strict: a key it does not take is refused, never dropped. A dropped `column` (the board's own word for
// a status) left a card waiting off every board with nothing said (docs/specs/026-plan/plan-agents.md).
const itemChange = z.discriminatedUnion('op', [
  z.strictObject({
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
  z.strictObject({
    op: z.literal('set'),
    item: itemRef,
    fields: fieldsArg.optional(),
    clear: z.array(z.string()).optional().describe('Fields to clear, by name (never title).'),
    type: typeArg.optional().describe('Change its card type.'),
  }),
  z.strictObject({
    op: z.literal('move'),
    item: itemRef,
    status: statusArg.describe('The column it moves to, by name; it moves there on every board.'),
    before: itemRef
      .optional()
      .describe('The item it lands before; the end of the column when absent.'),
  }),
  z.strictObject({ op: z.literal('delete'), item: itemRef }),
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
    .describe(
      'The tab to put it on, which must be in Plan; defaults to the first tab with a board, else the first tab.',
    ),
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
      'The card types it shows and takes, by name or id; an empty list takes none. Absent: the preset’s (todo ' +
        'takes Actions, roadmap Projects, sprint Stories, Tasks and Bugs...; the answer says), or every type ' +
        'for columns by name. A preset’s Bug or Story the document lacks is added to its card types.',
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
  cardSize: z
    .enum(['minimal', 'compact', 'detailed'])
    .optional()
    .describe(
      'How much of each card it draws: minimal (one line), compact (a title over one row), detailed (every ' +
        'field, the title on up to three lines).',
    ),
  cardFields: z
    .array(z.string())
    .optional()
    .describe(
      'The built-in fields its cards show, by name, whole: Number, Type, Assignee, Priority, Labels, Estimate, ' +
        'Start Date, Due Date, Votes, Checklist, Comments, Description. A built-in field shows on a card only ' +
        'when both this list and the card type’s display have it; custom fields follow the type’s display alone.',
    ),
  swimlanes: z
    .string()
    .optional()
    .describe(
      'Its rows: none, assignee, type, priority, status, or a field by name ("Severity", "Role"): a row per ' +
        'value, across every column.',
    ),
  doneColumn: z
    .string()
    .nullable()
    .optional()
    .describe(
      'The column whose cards count as done (Completion, and the Done phase charts read), by name; null for none.',
    ),
  renameColumns: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      'Columns renamed in place, old name to new ({"To Do": "Backlog"}): each keeps its cards, WIP limit and ' +
        'colour. Applied before columns, which can then use the new names.',
    ),
  types: z
    .union([z.array(z.string()), z.literal('every type')])
    .optional()
    .describe(
      'The card types it shows and takes, by name; "every type" shows every type again, and an empty list ' +
        'takes none (no card shows on it).',
    ),
};

const customField = z.object({
  name: z.string().min(1).describe('The field’s name, as cards show it ("Severity").'),
  kind: z
    .enum(CUSTOM_FIELD_KINDS)
    .describe(
      'text (one line), longtext (paragraphs, in a panel tab), number, currency (an amount in the field’s ' +
        'currency, shown as "£12,500"), date (YYYY-MM-DD), checkbox, link (a URL, shown as its site), email (one ' +
        'address), choice (one of its options), multichoice (several of its options, as a list), rating (a ' +
        'whole number from 1 to its scale, drawn as stars) or card (one card of linkType, as "#12").',
    ),
  options: z
    .array(z.string())
    .optional()
    .describe('A choice or multichoice field’s options, in order (up to 20).'),
  scale: z
    .number()
    .int()
    .min(3)
    .max(10)
    .optional()
    .describe('A rating field’s top score, 3 to 10; 5 when left out.'),
  linkType: typeArg.optional().describe('A card field’s target card type.'),
  currency: z
    .string()
    .optional()
    .describe('A currency field’s ISO 4217 code (GBP, USD, EUR...); GBP when left out.'),
  onCard: z
    .boolean()
    .optional()
    .describe('Draw it on the card face (placed on the type’s Display).'),
});

const colourArg = z
  .string()
  .describe(`A #rrggbb colour, e.g. ${PLAN_TYPE_COLOURS.slice(0, 4).join(' ')}.`);
const glyphArg = z.string().describe(`A Plan glyph id: ${PLAN_GLYPH_IDS.join(', ')}.`);
const builtInFields = z
  .array(z.string())
  .describe(
    'Built-in fields by name: description, assignee, priority, labels, estimate, start, due, checklist, parent, color.',
  );

// A type's card face per size: each place on the card a list of fields by name, in order.
const fieldList = z.array(z.string());
const displayArg = z
  .object({
    minimal: z
      .object({ beforeTitle: fieldList.optional(), afterTitle: fieldList.optional() })
      .optional()
      .describe('One line: Number, Priority, Due Date and Assignee can sit beside the title.'),
    compact: z
      .object({
        besideTitle: fieldList.optional(),
        belowTitle: fieldList.optional(),
        bottomRight: fieldList.optional(),
      })
      .optional()
      .describe(
        'The title over one row: Number, Type, Assignee, Priority, Start Date, Due Date, Votes, Comments.',
      ),
    detailed: z
      .object({
        header: fieldList.optional(),
        headerEnd: fieldList.optional(),
        underTitle: fieldList.optional(),
        footer: fieldList.optional(),
        bottomRight: fieldList.optional(),
      })
      .optional()
      .describe('Every field: a header row, the title, what sits under it, a footer row.'),
  })
  .describe(
    'What its cards show at each card size and where, fields by name (Number, Type, Assignee, Priority, ' +
      'Labels, Estimate, Start Date, Due Date, Votes, Checklist, Comments, Description, or a custom field by ' +
      'name). Any size draws custom fields. A size given replaces that size; one left out keeps its own. A field ' +
      'shows on a card only when the type has it and the card has a value.',
  );
const tabsArg = z
  .array(z.object({ name: z.string().min(1).max(24), fields: fieldList }))
  .max(6)
  .describe(
    'The item panel’s tabs, left to right, fields by name (never Title or Votes; each field in one tab). ' +
      'Fields in no tab show under Details. Replaces the tabs whole.',
  );
const detailsLabelArg = z.string().describe('What the panel calls Details (1-24 characters).');
const customFieldEdit = z.object({
  field: z.string().describe('The custom field, by name.'),
  name: z.string().optional().describe('A new name.'),
  options: z
    .array(z.string())
    .optional()
    .describe('A choice or multichoice field’s options, replaced whole.'),
  currency: z.string().optional().describe('A currency field’s ISO 4217 code.'),
  onCard: z.boolean().optional(),
});

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
      .describe(
        'The column a card of it starts in when none is given (a board’s column always places its own cards). A ' +
          'column no board has yet leaves it unset, so the type can come before its board.',
      ),
    excludedStatuses: z
      .array(z.string())
      .optional()
      .describe('Columns, by name, its cards never move into.'),
    display: displayArg.optional(),
    tabs: tabsArg.optional(),
    detailsLabel: detailsLabelArg.optional(),
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
    editCustom: z
      .array(customFieldEdit)
      .optional()
      .describe('Custom fields edited in place; values on cards stay.'),
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
    display: displayArg.optional(),
    tabs: tabsArg.optional(),
    detailsLabel: detailsLabelArg.optional(),
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
  kind: z
    .string()
    .describe(
      'text, longtext, number, currency, date, checkbox, link, email, choice, multichoice, rating or card.',
    ),
  options: z.array(z.string()).optional().describe('A choice or multichoice field’s options.'),
  scale: z.number().optional().describe('A rating field’s top score.'),
  linkType: z.string().optional().describe('A card field’s target card type id.'),
  currency: z.string().optional().describe('A currency field’s ISO 4217 code.'),
  onCard: z.boolean().optional().describe('Drawn on Detailed cards by default.'),
});

const listedType = z.object({
  id: z.string().describe('The card type id ("task", "bug").'),
  name: z.string().describe('The name boards show ("Task").'),
  color: z.string().describe('Its colour.'),
  glyph: z.string().describe('Its glyph id.'),
  fields: z.array(z.string()).describe('Its built-in fields.'),
  custom: z.array(listedCustom).describe('Its custom fields.'),
  defaultStatus: z.string().optional().describe('The column a new card of it starts in.'),
  display: z
    .record(z.string(), z.record(z.string(), z.array(z.string())))
    .describe(
      'What its cards show per size, by place and field name (the display change_card_types takes).',
    ),
  tabs: z
    .array(
      z.object({
        name: z.string().describe('The tab’s name.'),
        fields: z.array(z.string()).describe('Its fields, by name.'),
      }),
    )
    .describe('Its item panel’s tabs; fields in none show under Details.'),
  detailsLabel: z.string().describe('What its panel calls Details.'),
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
  cardSize: z.enum(['minimal', 'compact', 'detailed']).describe('How much of each card it draws.'),
  cardFields: z.array(z.string()).describe('The built-in fields its cards show, by name.'),
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
