// The Plan tools' input and output shapes (docs/specs/026-plan/plan-agents.md, docs/specs/015-api/mcp-server.md
// §4.9b): list_items, change_items, add_board and change_card_types. Everything is named as people name it (a
// column name, a card type's name, a custom field's name, a person's name, "#12"); the server resolves the ids.
import { z } from 'zod';
import {
  CALCULATIONS,
  CALCULATION_LABELS,
  AGGREGATES,
  AGGREGATE_LABELS,
  CARD_SIZES,
  CUSTOM_FIELD_KINDS,
  FORMULA_MAX,
  FORMULA_RESULTS,
  FUNCTION_NAMES,
  PLAN_BOARD_PRESET_IDS,
  PLAN_COLUMNS_MAX,
  PLAN_GLYPH_IDS,
  PLAN_TYPE_COLOURS,
  readCardSize,
} from '@liveplanner/items';

// A board's card size: Minimal or Detailed. The retired `compact`, which older prompts still send, reads as detailed
// (docs/specs/026-plan/plan-agents.md "Changing a board"); the schema offers only the two.
const cardSizeArg = z.preprocess(
  (v) => (typeof v === 'string' && v.trim().toLowerCase() === 'compact' ? readCardSize(v) : v),
  z.enum(CARD_SIZES),
);

const url = z.string().describe('Link that opens the plan in the liveplanner editor.');
const projectId = z.string().describe('The plan (from find_projects).');
const itemRef = z.string().describe('The item, by its number ("#12") or an id prefix.');
const statusArg = z
  .string()
  .describe(
    'A column, by its name as the board shows it ("In Progress"), case aside. list_items lists them.',
  );
const typeArg = z
  .string()
  .describe('A card type, by name or id ("Task", "bug"). list_items lists the plan’s card types.');

const fieldsArg = z
  .record(z.string(), z.unknown())
  .describe(
    'Fields by name: description (Markdown: # headings, **bold**, *italic*, [links](https://…), - bullets; ' +
      'shown formatted on the card), status (a column name), assignee (a person’s name, e.g. "Sam"), priority ' +
      '(urgent|high|medium|low), labels (["seo","copy"] or "seo, copy"), estimate (0-999), start and due ' +
      '(YYYY-MM-DD), color (a #rrggbb colour, e.g. ' +
      PLAN_TYPE_COLOURS.slice(0, 4).join(' ') +
      '), checklist [{text,done}], parent ("#12", a Project), and the card type’s custom fields by name ' +
      '("Severity": "S2"; a Card field takes "#12"; a field marked multiple takes a list or a comma list, "Sam, Ana" or ' +
      '"#3, #5"; a longtext field takes Markdown, as description does). A field the card type lacks is refused: add it with ' +
      'change_card_types. A new card must give every custom field list_items marks required. Attachments ' +
      '(pictures) are added in the card panel only: they can be cleared, never set.',
  );

export const listItemsShape = {
  projectId,
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
  projectId,
  changes: z
    .array(itemChange)
    .min(1)
    .max(50)
    .describe('Applied in order; each sees the ones before it. A refused change stops the rest.'),
};

export const addBoardShape = {
  projectId,
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
      'Column names, left to right, replacing the preset’s. A name the plan’s boards already use shares ' +
        'their column, so its cards show here too.',
    ),
  types: z
    .array(z.string())
    .optional()
    .describe(
      'The card types it shows and takes, by name or id; an empty list takes none. Absent: the preset’s (todo ' +
        'takes Actions, roadmap Projects, sprint Stories, Tasks and Bugs...; the answer says), or every type ' +
        'for columns by name. A preset’s Bug or Story the plan lacks is added to its card types.',
    ),
};

export const changeBoardShape = {
  projectId,
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
  cardSize: cardSizeArg
    .optional()
    .describe(
      'How much of each card it draws: minimal (one line) or detailed (every field, the title on up to three ' +
        'lines).',
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
  sortBy: z
    .array(
      z.object({
        field: z
          .string()
          .describe(
            'A field by name or id: Priority, Estimate, Start Date, Due Date, Created At, Last Edited At, or a number, currency, percent, ' +
              'date, rating or choice field ("Value").',
          ),
        direction: z
          .enum(['ascending', 'descending'])
          .optional()
          .describe(
            'ascending (lowest or earliest first, a choice in option order; the default) or descending.',
          ),
      }),
    )
    .max(2)
    .optional()
    .describe(
      'Sort Cards: each column orders its cards by up to two fields, then by hand order; [] turns it off. ' +
        'While sorted, people cannot reorder cards within a column.',
    ),
  doneColumns: z
    .array(z.string())
    .max(PLAN_COLUMNS_MAX)
    .optional()
    .describe(
      'The columns whose cards count as done (Completion, Points, and the Done phase charts read), by name, ' +
        'whole: the named ones count and no other does; [] for none. A column added without it counts as done ' +
        'when its name is a closing one (Done, Won’t Do, Cancelled, Closed, Shipped ...).',
    ),
  doneColumn: z
    .string()
    .nullable()
    .optional()
    .describe(
      'Older: the column whose cards count as done, and every column after it; null for none. Not with doneColumns.',
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

// A Calculated field's calculation (docs/specs/026-plan/item-types.md "Calculated fields").
const calculationArg = z
  .string()
  .describe(
    `A calculated field's calculation: ${CALCULATIONS.map((c) => `${c} (${CALCULATION_LABELS[c]})`).join(', ')}. ` +
      'Children are the cards linking to the card through a card field naming its type (Parent, for a Project); ' +
      'done is a done column’s status. Children Done is a whole percentage, null with no children. rollup works ' +
      'one of the children’s fields out (aggregate, source, through), lookup shows a field of the card a card ' +
      'field links to (through, source), and formula works the value out from the card’s own fields by its formula.',
  );

// A Rollup's or Lookup's settings (docs/specs/026-plan/item-types.md "Rollup and Lookup fields").
const throughArg = z
  .string()
  .describe(
    'A rollup’s or lookup’s card field, by name: a lookup reads the card its own card field links to (Parent); ' +
      'a rollup reads the children linking here through a card field (Parent), or every child with "all" (the ' +
      'default).',
  );
const aggregateArg = z
  .string()
  .describe(
    `What a rollup works out over the children: ${AGGREGATES.map((a) => `${a} (${AGGREGATE_LABELS[a]})`).join(', ')}. ` +
      'sum, average, min and max read a number, currency, rating, estimate or (not sum) percent field; earliest ' +
      'and latest a date field; count and countDone none.',
  );
const sourceArg = z
  .string()
  .describe(
    'The field a rollup aggregates on the children, or a lookup shows from the linked card, by name. Its result ' +
      '(and a currency’s code) is taken from that field.',
  );

// A Formula field's expression and result kind (docs/specs/026-plan/item-types.md "Formula fields").
const formulaArg = z
  .string()
  .describe(
    `A formula field’s expression over the card’s fields by name (up to ${FORMULA_MAX} characters): ` +
      'Budget - Spent, Estimate * Rate, days(Due - Start), if(Score >= 8, "Strong", "Weak"). A name with other ' +
      'characters goes in braces: {Children Done (%)}. Operators + - * / and brackets, comparisons = != < <= > >=; ' +
      `functions ${FUNCTION_NAMES.join(', ')}. A field holding several reads as a list: len() counts it, ` +
      'concat() joins it. Refused, with the problem, when it can’t be read.',
  );
const resultArg = z
  .string()
  .describe(
    `A formula field’s result: ${FORMULA_RESULTS.join(', ')} (number when left out); currency takes currency.`,
  );

// Show As (docs/specs/026-plan/item-types.md "Percent"): a worked-out share drawn as a Percent field is.
const showAsArg = z
  .enum(['percent', 'number'])
  .describe(
    'A calculated childrenDone field, or a formula field whose result is percent, only: percent draws its share ' +
      'as a percent field’s bar, number as text ("40%", the default).',
  );

// Notifies (docs/specs/026-plan/item-types.md "Notifies"): a person field, and the Assignee, telling their person.
const notifiesArg = z
  .boolean()
  .describe(
    'A person field only: true tells its person when a card is theirs (the Inbox, emails, Only Mine), false stops.',
  );
// Holds Several (docs/specs/026-plan/item-types.md "Holds Several"): a person or card field holding a list.
const multipleArg = z
  .boolean()
  .describe(
    'A person or card field only: true holds several people or cards (written as a comma list or a list), false ' +
      'holds one again (cards keep what they hold).',
  );
const assigneeNotifiesArg = z
  .boolean()
  .describe('false stops the Assignee telling its person when a card is theirs; true tells again.');

const customField = z.object({
  name: z.string().min(1).describe('The field’s name, as cards show it ("Severity").'),
  kind: z
    .enum(CUSTOM_FIELD_KINDS)
    .describe(
      'text (one line), longtext (rich paragraphs, in a panel tab; written as Markdown), number, currency (an amount in the field’s ' +
        'currency, shown as "£12,500"), percent (how far along: a whole number from 0 to 100, ' +
        'drawn as a bar; "40%" is taken too, and a value outside 0 to 100 is refused), duration (hours and ' +
        'minutes, stored as whole minutes: written "2h 30m", "90m", "1.5h" or a number of minutes, read as "2h 30m"; ' +
        'with timeSpent it adds up the time people track with a timer, read-only to agents), date (YYYY-MM-DD), checkbox, link (a URL, shown as its site), email (one ' +
        'address), choice (one of its options), multichoice (several of its options, as a list), rating (a ' +
        'whole number from 1 to its scale, drawn as stars), card (one card of its linkTypes, as "#12", or several ' +
        'with multiple), ' +
        'calculated (worked out from the cards linking to the card through a card field, by its calculation; ' +
        'read-only, never given a value), person (someone, by name, as the assignee takes one, or several with ' +
        'multiple), labels (a list, ' +
        'as labels takes one), colour (#rrggbb), checklist (rows of { text, done }), image (a picture added ' +
        'in the card panel; an agent may clear it, never set one), comments (its own comment threads: start ' +
        'one in it with change_threads) or votes (its own votes, from a session vote that counts in it; never ' +
        'set).',
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
  linkType: typeArg
    .optional()
    .describe('A card field’s target card type (one; or give linkTypes).'),
  linkTypes: z
    .array(typeArg)
    .optional()
    .describe(
      'A card field’s target card types, one or more; merged after linkType when both are given.',
    ),
  currency: z
    .string()
    .optional()
    .describe('A currency field’s ISO 4217 code (GBP, USD, EUR...); GBP when left out.'),
  calculation: calculationArg.optional(),
  formula: formulaArg.optional(),
  result: resultArg.optional(),
  through: throughArg.optional(),
  aggregate: aggregateArg.optional(),
  source: sourceArg.optional(),
  showAs: showAsArg.optional(),
  timeSpent: z
    .boolean()
    .optional()
    .describe(
      'A duration field only, set when it is made: true makes it Time Spent, adding up the time people track ' +
        'on the card with a start/stop timer and manual entries (who and when). Agents read it, never write it.',
    ),
  onCard: z
    .boolean()
    .optional()
    .describe('Draw it on the card face (placed on the type’s Display).'),
  required: z
    .boolean()
    .optional()
    .describe(
      'Every new card of the type must give it a value, and no change may empty it (any kind but checkbox).',
    ),
  notifies: notifiesArg.optional(),
  multiple: multipleArg.optional(),
});

const colourArg = z
  .string()
  .describe(`A #rrggbb colour, e.g. ${PLAN_TYPE_COLOURS.slice(0, 4).join(' ')}.`);
const glyphArg = z.string().describe(`A Plan glyph id: ${PLAN_GLYPH_IDS.join(', ')}.`);
const builtInFields = z
  .array(z.string())
  .describe(
    'Built-in fields by name: description, assignee, priority, labels, estimate, start, due, checklist, ' +
      'attachments, parent, color.',
  );

// A type's card face per size: each place on the card a list of fields by name, in order.
const fieldList = z.array(z.string());
const displayArg = z
  .object({
    minimal: z
      .object({ beforeTitle: fieldList.optional(), afterTitle: fieldList.optional() })
      .optional()
      .describe('One line: Number, Priority, Due Date and Assignee can sit beside the title.'),
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
      'Labels, Estimate, Start Date, Due Date, Votes, Checklist, Comments, Description, Age (days in its column), ' +
      'Created At, Created By, Last Edited At, Last Edited By (filled in automatically), ' +
      'or a custom field by name). Any size draws custom fields. A size given replaces that size; one left out keeps its own. A field ' +
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
  linkTypes: z
    .array(typeArg)
    .optional()
    .describe('A card field’s target card types, replaced whole (one or more).'),
  currency: z.string().optional().describe('A currency field’s ISO 4217 code.'),
  calculation: calculationArg.optional(),
  formula: formulaArg.optional(),
  result: resultArg.optional(),
  through: throughArg.optional(),
  aggregate: aggregateArg.optional(),
  source: sourceArg.optional(),
  showAs: showAsArg.optional(),
  onCard: z.boolean().optional(),
  required: z
    .boolean()
    .optional()
    .describe('true makes it required (any kind but checkbox), false optional again.'),
  notifies: notifiesArg.optional(),
  multiple: multipleArg.optional(),
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
    statuses: z
      .array(z.string())
      .optional()
      .describe(
        'The columns, by name, its cards may move into, in the order its status menu lists them; default ' +
          'every column the boards have. A board added later gives its columns only to the types it takes.',
      ),
    display: displayArg.optional(),
    tabs: tabsArg.optional(),
    detailsLabel: detailsLabelArg.optional(),
    assigneeNotifies: assigneeNotifiesArg.optional(),
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
    statuses: z
      .array(z.string())
      .optional()
      .describe(
        'The whole ordered list of columns, by name, its cards may move into (its status menu’s order); a ' +
          'column left out is one they never move into.',
      ),
    display: displayArg.optional(),
    tabs: tabsArg.optional(),
    detailsLabel: detailsLabelArg.optional(),
    assigneeNotifies: assigneeNotifiesArg.optional(),
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
        'Adds any of Project, Task, Note, Idea and Action the plan lacks; changes none it has.',
      ),
  }),
  z.object({
    op: z.literal('restore_built_ins').describe('The older name of add_default_types.'),
  }),
]);

export const changeCardTypesShape = {
  projectId,
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
      'text, longtext, number, currency, percent, duration, date, checkbox, link, email, choice, multichoice, ' +
        'rating, card, calculated, person, labels, colour, checklist or image.',
    ),
  options: z.array(z.string()).optional().describe('A choice or multichoice field’s options.'),
  scale: z.number().optional().describe('A rating field’s top score.'),
  linkType: z.string().optional().describe('A card field’s first target card type id.'),
  linkTypes: z
    .array(z.string())
    .optional()
    .describe('Every card type id a card field links to, linkType first.'),
  currency: z.string().optional().describe('A currency field’s ISO 4217 code.'),
  calculation: z
    .string()
    .optional()
    .describe(
      'A calculated field’s calculation: childCount, childrenDone, rollup, lookup or formula.',
    ),
  through: z
    .string()
    .optional()
    .describe('A rollup’s or lookup’s card field by name; "all" for a rollup over every child.'),
  aggregate: z
    .string()
    .optional()
    .describe('What a rollup works out (sum, average, countDone ...).'),
  source: z
    .string()
    .optional()
    .describe('The field a rollup aggregates or a lookup shows, by name.'),
  error: z
    .string()
    .optional()
    .describe(
      'Why a rollup or lookup stopped working (a field it read is gone): its values read null.',
    ),
  formula: z
    .string()
    .optional()
    .describe('A formula field’s expression, with field names, as change_card_types takes it.'),
  result: z
    .string()
    .optional()
    .describe(
      `A formula’s, rollup’s or lookup’s result: ${FORMULA_RESULTS.join(', ')}; the value reads as it.`,
    ),
  formulaError: z
    .string()
    .optional()
    .describe(
      'Why a formula field stopped working (a field it read was deleted): its values read null.',
    ),
  showAs: z
    .literal('percent')
    .optional()
    .describe(
      'A calculated field drawn as a percent field’s bar; its value is still a whole percentage.',
    ),
  timeSpent: z
    .literal(true)
    .optional()
    .describe(
      'A duration field that adds up tracked time: its value is the total ("4h 15m") and each card lists its ' +
        'entries and running timers under time.',
    ),
  readOnly: z
    .literal(true)
    .optional()
    .describe('A calculated field: each card lists its value, and change_items can’t set it.'),
  onCard: z.boolean().optional().describe('Drawn on Detailed cards by default.'),
  required: z
    .boolean()
    .optional()
    .describe(
      'Required: change_items refuses a new card of the type without it, or a set emptying it.',
    ),
  notifies: z
    .boolean()
    .optional()
    .describe('A person field that tells its person when a card is theirs (the Inbox, emails).'),
});

const listedType = z.object({
  id: z.string().describe('The card type id ("task", "bug").'),
  name: z.string().describe('The name boards show ("Task").'),
  color: z.string().describe('Its colour.'),
  glyph: z.string().describe('Its glyph id.'),
  fields: z.array(z.string()).describe('Its built-in fields.'),
  custom: z.array(listedCustom).describe('Its custom fields.'),
  defaultStatus: z.string().optional().describe('The column a new card of it starts in.'),
  statuses: z
    .array(z.string())
    .describe('The columns its cards may move into, by name, in the order its Status list shows.'),
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
  assigneeNotifies: z
    .literal(false)
    .optional()
    .describe('Given when its Assignee tells no one; the Assignee notifies otherwise.'),
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
  sortBy: z
    .array(z.string())
    .optional()
    .describe(
      'Sort Cards, as "Priority (Highest First)": its columns list their cards in that order.',
    ),
  columns: z
    .array(
      z.object({
        name: z.string().describe('The column name: what status takes.'),
        status: z.string().describe('The status id items store.'),
        wipLimit: z.number().optional().describe('The most cards the column should hold.'),
        done: z.literal(true).optional().describe('Its cards count as done.'),
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
      'Every field, title and status included; custom fields by their names, as change_items takes them. A ' +
        'calculated field’s value is worked out (a count, a whole percentage, a formula’s number, text, ' +
        'true or false or ISO date, or null) and read-only. A duration reads as text ("2h 30m").',
    ),
  time: z
    .record(
      z.string(),
      z.object({
        entries: z
          .array(z.object({ by: z.string(), time: z.string(), at: z.string() }))
          .describe('Time recorded: who, how long ("1h 15m") and when (ISO).'),
        running: z
          .array(z.object({ by: z.string(), since: z.string() }))
          .describe('Timers running now: who, and since when (ISO).'),
      }),
    )
    .optional()
    .describe('Each Time Spent field with time on the card, by the field’s name.'),
});

export const listItemsOutput = {
  boards: z.array(listedBoard).describe('The Plan boards, in tab then canvas order.'),
  notOnBoard: z.array(z.string()).describe('Cards no board column shows.'),
  count: z.number().describe('How many items are listed.'),
  items: z.array(listedItem).describe('The items, by number.'),
  types: z.array(listedType).describe('The plan’s card types.'),
  hint: z.string().optional().describe('What to do when the plan has no board.'),
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
      'Card types the board brought into the plan, by name (a bug-triage board brings Bug when the ' +
        'plan lacks it); empty when it had them all.',
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
        done: z.literal(true).optional().describe('Its cards count as done.'),
      }),
    )
    .describe('Its columns now, left to right.'),
  takes: z
    .union([z.array(z.string()), z.literal('every type')])
    .describe('The card types it shows now.'),
  cardSize: z.enum(CARD_SIZES).describe('How much of each card it draws.'),
  cardFields: z.array(z.string()).describe('The built-in fields its cards show, by name.'),
  sortBy: z
    .array(z.string())
    .describe('Sort Cards now, as "Priority (Highest First)"; empty for hand order.'),
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
