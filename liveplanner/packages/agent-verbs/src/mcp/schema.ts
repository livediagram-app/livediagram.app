// The element-schema MCP resource (docs/specs/015-api/mcp-server.md §4.5) + the tools' zod input shapes.
// The element kinds and their fields come from @liveplanner/edit-operations, the one list edit operations and the
// value check read, so the format carried inline on every tool argument that takes elements (ELEMENT_SCHEMA_HINT)
// cannot drift from what is accepted. It states that completeness as a fact about the tools rather than as a rule for
// the caller: a description that tells a model how to behave, or steers it away from other tools, is a
// connector-listing flag (docs/specs/015-api/mcp-server.md §4.15). isValidTab in the project package stays the runtime
// guard.
import { z } from 'zod';
import { METRIC_KINDS, PLAN_VISUALISATIONS } from '@liveplanner/items';
import {
  FIND_QUERY_MAX_LENGTH,
  REF_INPUT_MAX_LENGTH,
  TAB_VIEW_NAMES,
  VIEW_BUDGET_MAX,
} from '@liveplanner/api-schema';
import {
  PLAN_COMMON_FIELDS,
  PLAN_ELEMENT_ABOUT,
  PLAN_ELEMENT_KINDS,
  PLAN_KIND_FIELDS,
} from '@liveplanner/edit-operations';
import {
  ELEMENT_FIELD_VALUES,
  FINISHES,
  type Finish,
  NAME_MAX_LENGTH,
  THEMES,
  truncateName,
} from '@liveplanner/project';

export const SCHEMA_RESOURCE_URI = 'liveplanner://schema/elements';

const themeIds = THEMES.map((t) => t.id).join(', ');

// One kind's fields as facts: its own, a closed field with its values.
const fieldsText = (fields: readonly string[]) =>
  fields
    .map((f) =>
      ELEMENT_FIELD_VALUES[f] ? `"${f}" (${ELEMENT_FIELD_VALUES[f].join(', ')})` : `"${f}"`,
    )
    .join(', ');

const KIND_LINES = PLAN_ELEMENT_KINDS.map(
  (kind) =>
    `shape "${kind}": ${PLAN_ELEMENT_ABOUT[kind]}; takes ${fieldsText(PLAN_KIND_FIELDS[kind])}.`,
);

const CHART_SOURCE =
  'A chart\'s "chartSource" is { "sheetId", "range": { "r1", "c1", "r2", "c2" } }: a sheet of the plan ' +
  '(list_sheets) and the row and column ids of its first and last cells (read_sheet).';

// Self-contained element schema, attached to each tool's element argument so the
// model reads it straight from the tool definition (see the comment above).
const ELEMENT_SCHEMA_HINT =
  'An array of element objects. This is the COMPLETE format, documented inline ' +
  'here: the tool definition is the full reference for it. ' +
  'Each element: { "id": a unique string, "type": "shape", "shape", "x", "y", "width", "height", and ' +
  `optional ${fieldsText(PLAN_COMMON_FIELDS.filter((f) => !['x', 'y', 'width', 'height'].includes(f)))} }. ` +
  'A liveplanner tab holds only these shapes; any other element is refused. ' +
  KIND_LINES.join(' ') +
  ' ' +
  CHART_SOURCE +
  " Cards are items (change_items), cells are a sheet's (change_sheet), and a Dashboard is easiest made " +
  'whole with "dashboard".';

export function elementSchemaDoc(): string {
  return `# liveplanner element schema

A plan holds tabs: Board, Sheet, Dashboard and Form tabs. A tab is
{ name, elements: Element[] }; a Form tab holds its form, not elements.
create_project makes a plan with one or more tabs at once; add_tab appends
another tab to an existing plan.

## Elements
Every element is { "id", "type": "shape", "shape", "x", "y", "width", "height" }
with an optional ${fieldsText(PLAN_COMMON_FIELDS.filter((f) => !['x', 'y', 'width', 'height'].includes(f)))}.
A tab holds only these shapes; any other element is refused:

${KIND_LINES.map((l) => `- ${l}`).join('\n')}

${CHART_SOURCE}

Cards are items: change_items adds and moves them, and a board shows them.
A sheet's cells change through change_sheet. A Dashboard is easiest made
whole: pass "dashboard" (its tabs, metrics, charts and notes) on create_project,
add_tab or update_project, and the server lays it out.

## Themes (the look)
Set "theme" on create_project / add_tab to one of these presets:
  ${themeIds}
Defaults to "brand", the Default scheme, which follows each reader's own
light / dark setting.

## Templates
list_templates lists the Plan scaffolds (kanban, project planner, bug triage,
...) to pass as "template".
`;
}

// Server-level instructions echo the essentials for clients that don't read
// resources (docs/specs/015-api/mcp-server.md §4.5). Phrased as facts about the server (what it does
// with what you send, and where the format is written down), not as rules for
// the calling model (docs/specs/015-api/mcp-server.md §4.15).
export const SERVER_INSTRUCTIONS = `Tools to find, read, create, add tabs to, change, share, rename, delete (to the Trash) and restore the user's liveplanner plans. A plan holds tabs: Board tabs of cards, Sheet tabs (spreadsheets), Dashboard tabs and Form tabs.
list_templates lists the Plan templates (kanban, project-planner, bug-triage, budget-planner, ...):
pass a kind as "template" on create_project or add_tab to start a plan or a tab from it. A "dashboard" on
create_project or add_tab makes a Dashboard tab over the plan's Board and Sheet tabs by name: metrics, Gantts,
calendars, workload charts and notes, drawn live from the cards. update_project changes a tab's elements, or rebuilds
a Dashboard tab whole; the element format is documented inline on each tool's element argument.
Plan boards hold cards (items), which have their own tools:
list_items reads a plan's boards, their columns by name, its cards and its
card types; change_items adds, edits and moves cards, naming columns, card
types, fields and people as the board shows them; add_board puts a board on a
tab (a preset or columns by name) and change_board changes one (title, columns,
the card types it shows); import_board makes a Board tab, or a new plan, from a
Trello, Asana, Jira or Linear export; change_card_types adds and edits card types and their
custom fields. A board shows only the card types it takes. Cards hold comment threads:
list_threads reads them (titles, state, cards, Comments field and comments) and change_threads starts,
replies to, resolves and reopens them, and edits or deletes its own comments, each marked
Generated by AI. Sheets (spreadsheets on a tab) have
theirs: list_sheets lists a plan's sheets, read_sheet reads one's cells by A1
(inputs, worked-out values and what they show), change_sheet sets, clears and
formats cells, inserts and deletes rows and columns, sorts, freezes and renames,
and sets dropdowns, checkboxes and other validation rules and conditional formats,
and add_sheet puts a new Sheet on a tab, blank or from rows or CSV text.
Form tabs hold forms (like Google Forms): questions anyone fills in from a link,
without an account, each response a card on a Board tab or a row in a sheet.
add_form makes one (from a starter or questions, in a plan of its own when
no projectId is given), change_form changes it, read_form reads it with its
link, state and anything stopping it being published, share_form publishes,
closes or deletes its link, and try_form fills it in as a test response. Asked for a form, survey, sign-up or RSVP, make a
form; its responses are read with list_items (cards) or read_sheet (rows).`;

// --- Tool input shapes (ZodRawShape). Element arrays are permissive; isValidTab
// is the real guard, so there's no second schema to drift. ---

const elementArray = z.array(z.record(z.string(), z.unknown())).describe(ELEMENT_SCHEMA_HINT);

// Template kinds are validated at runtime against the shared catalogue
// (@liveplanner/templates) rather than a z.enum, so a new template is one
// catalogue entry with no schema churn; list_templates is the discovery
// surface.
// A new Dashboard tab (docs/specs/026-plan/plan-agents.md "Making a dashboard"), everything named as people name it.
const dashboardField = z
  .object({
    tabs: z
      .union([z.array(z.string()), z.literal('every')])
      .optional()
      .describe(
        'The Board and Sheet tabs it shows, by name (in create_project, other tabs of the same call), or "every"; ' +
          'two to a row.',
      ),
    metrics: z
      .array(z.enum(METRIC_KINDS))
      .optional()
      .describe(
        'Metric tiles, four to a row: count (cards), progress (percent done), people, types, priorities, due ' +
          '(overdue and due soon), unassigned, points (estimates), top-voted, stale.',
      ),
    charts: z
      .array(
        z.object({
          view: z
            .enum(PLAN_VISUALISATIONS)
            .exclude(['status-mix'])
            .describe(
              'gantt, calendar (by due date), start-calendar, workload (cards by a field), priority-matrix ' +
                '(priority by status), search.',
            ),
          groupBy: z
            .string()
            .optional()
            .describe(
              'workload only: assignee (default), type, priority, status, or a field by name.',
            ),
          types: z.array(z.string()).optional().describe('Only these card types, by name.'),
          startField: z
            .string()
            .optional()
            .describe(
              'gantt and start-calendar: the Date field it reads as the start, by name (Start Date by default).',
            ),
          dueField: z
            .string()
            .optional()
            .describe(
              'gantt and calendar: the Date field it reads as the due date, by name (Due Date by default).',
            ),
          measure: z
            .string()
            .optional()
            .describe(
              'workload only: what each bar adds up: Cards (default), Estimate, or a Number field by name.',
            ),
          name: z
            .string()
            .optional()
            .describe(
              "The slot's own name, shown in place of the chart's generated heading (up to 80 characters).",
            ),
        }),
      )
      .optional()
      .describe('Charts, two to a row; a Gantt takes a row of its own.'),
    notes: z
      .array(
        z.object({
          title: z.string().describe('The note’s heading.'),
          text: z.string().describe('Its text; a line each.'),
        }),
      )
      .optional()
      .describe('Notes, three to a row.'),
  })
  .optional()
  .describe(
    'Make the tab a Plan Dashboard instead of giving elements: rows of the tabs it shows, then metrics, Gantts, other ' +
      'charts and notes, each drawn live from the cards; up to 12 rows. Give it in place of elements or template.',
  );

const templateField = z
  .string()
  .optional()
  .describe(
    'Start from a hand-tuned template scaffold instead of providing elements: a template ' +
      'kind from list_templates (e.g. "kanban", "project-planner", "bug-triage"). The server ' +
      'builds it and paints it with the chosen theme. Provide template OR elements, not both.',
  );

const themeField = z
  .string()
  .optional()
  .describe('Preset theme id that paints the tab. One of: ' + `${themeIds}. Defaults to "brand".`);

const finishField = z
  .enum(FINISHES as unknown as [Finish, ...Finish[]])
  .optional()
  .describe(
    'How the tab is drawn (docs/specs/008-canvas/finish.md): "flexible" (the default), "professional" ' +
      '(crisp corners, thin lines, no shadows), "sketch" (hand-drawn pencil lines, hatched fills, a ' +
      'handwriting font) or "marker" (bold felt-tip lines, coloured-in fills, marker lettering). An element ' +
      'can carry its own "finish" too.',
  );

export const findProjectsShape = {
  query: z.string().optional().describe('Only plans whose name contains this text.'),
  limit: z.number().int().min(1).max(50).optional().describe('Max results (default 20).'),
};

// What read_project fits every view to unless told otherwise (docs/specs/024-agents/project-views.md
// "Budgets", VW45).
export const READ_PROJECT_DEFAULT_BUDGET = 8000;

// The longest edit-operations text update_project takes: room for a few hundred lines.
const EDITS_MAX_CHARS = 40_000;

export const readProjectShape = {
  projectId: z.string().describe('The plan id (from find_projects).'),
  tabId: z.string().optional().describe('Which tab to read; defaults to the first.'),
  view: z
    .enum(TAB_VIEW_NAMES)
    .optional()
    .describe(
      'How to read the tab. outline (default): one line per element with its ref and label. comments: open ' +
        'threads in full. show: one element in full (needs ref). find: elements holding some text (needs q).',
    ),
  budget: z
    .number()
    .int()
    .min(1)
    .max(VIEW_BUDGET_MAX)
    .optional()
    .describe(
      `Fit the view to about this many tokens (default ${READ_PROJECT_DEFAULT_BUDGET}); the last line says what was left out and how to see it.`,
    ),
  only: z
    .string()
    .min(1)
    .max(REF_INPUT_MAX_LENGTH)
    .optional()
    .describe('outline: one element (a ref from a view) and what nests under it.'),
  ref: z
    .string()
    .min(1)
    .max(REF_INPUT_MAX_LENGTH)
    .optional()
    .describe('show: the element, by the ref a view printed, any unique prefix, or its id.'),
  q: z
    .string()
    .min(1)
    .max(FIND_QUERY_MAX_LENGTH)
    .optional()
    .describe('find: the text to look for, case-insensitive.'),
  all: z.boolean().optional().describe('comments: include resolved threads.'),
  style: z.boolean().optional().describe('outline: add the colours that differ from the defaults.'),
  format: z
    .enum(['view', 'json'])
    .optional()
    .describe("view (default) returns the text view; json returns the tab's elements as stored."),
  image: z
    .boolean()
    .optional()
    .describe('Also attach a PNG preview of the tab (costs about a thousand tokens).'),
};

// A project or tab name (docs/specs/006-project/name-length.md). Shortened with
// the same truncateName the api worker applies, so the name a tool reports back
// is the one stored; the cap is stated for the model in the description.
const nameField = (what: string, schema: z.ZodString = z.string()) =>
  schema
    .describe(
      `${what} Keep it short: at most ${NAME_MAX_LENGTH} characters. A longer name is ` +
        'shortened at a word boundary with an ellipsis.',
    )
    .transform(truncateName);

export const createProjectTab = z.object({
  name: nameField(
    'Name of the tab. Optional with a template (its own first tab name is used); otherwise "Tab n".',
  ).optional(),
  elements: elementArray.optional(),
  template: templateField,
  dashboard: dashboardField,
  theme: z
    .string()
    .optional()
    .describe('This tab’s theme, one of the theme ids above; the plan’s theme when left out.'),
});

export const createProjectShape = {
  name: nameField('Name for the new plan.'),
  // `tabs` is preferred; `tab` is accepted as an alias for a single tab so a
  // client with a stale cached schema (or one that just sends `tab`) still works
  // — provide one or the other.
  tabs: z
    .array(createProjectTab)
    .min(1)
    .max(20)
    .optional()
    .describe(
      'One or more tabs. Preferred: pass several to create a multi-tab plan in one call (e.g. a Board tab ' +
        'and a Dashboard tab over it).',
    ),
  // The alias is checked against the tab shape by the tool, not listed here a second time: the shape carries the
  // whole element format, and a definition twice its size is one a client's tool search ranks out of sight.
  tab: z
    .unknown()
    .optional()
    .describe('A single tab, shaped as one item of "tabs"; accepted as an alias for tabs: [tab].'),
  theme: themeField,
  finish: finishField,
  // Making a project is a use (docs/specs/015-api/mcp-server.md §4.3).
  markUsed: z
    .boolean()
    .optional()
    .describe(
      "Whether this plan joins the user's Jump back in (their most used and recent plans) " +
        'at once. Default true. Pass false when making many plans in one go, so a batch ' +
        "never pushes the user's own work out of reach.",
    ),
};

export const addTabShape = {
  projectId: z.string().describe('The plan to add a tab to (from find_projects / read_project).'),
  name: nameField('Name of the new tab.'),
  elements: elementArray.optional(),
  template: templateField,
  dashboard: dashboardField,
  theme: themeField,
  finish: finishField,
};

export const updateProjectShape = {
  projectId: z.string().describe('The plan to edit (from find_projects / read_project).'),
  tabId: z.string().optional().describe('Which tab to edit; defaults to the first.'),
  mode: z
    .enum(['replace', 'ops', 'edits'])
    .describe(
      '"replace" the whole tab, or change it in place: "ops" (an ops list, or "edits" text); "edits" names the same ' +
        'mode by its text form.',
    ),
  rev: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      'ops mode: the tab revision read_project returned. An element a person changed since is then a ' +
        'conflict, never silently overwritten; read again and redo the edit.',
    ),
  elements: elementArray
    .optional()
    .describe(`Replace mode: the full new element list. ${ELEMENT_SCHEMA_HINT}`),
  dashboard: dashboardField.describe(
    'Replace mode on a Dashboard tab: its tabs, metrics, charts and notes rebuilt whole (the tab keeps its id ' +
      'and name). Only a Dashboard tab takes one.',
  ),
  ops: z
    .array(
      z.object({
        op: z
          .enum(['add', 'update', 'remove'])
          .describe('"add" a new element, "update" fields of an existing one, or "remove" one.'),
        element: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'add: the full new element, with a unique id. update: only the fields to change, ' +
              'merged over the existing element. Not used by remove. Same format as "elements".',
          ),
        elementId: z
          .string()
          .optional()
          .describe(
            'update / remove: the existing element to change, by its id or the ref read_project prints.',
          ),
      }),
    )
    .optional()
    .describe('ops mode: ordered add / update / remove against existing elements, by id or ref.'),
  edits: z
    .string()
    .max(EDITS_MAX_CHARS)
    .optional()
    .describe(
      'ops mode, instead of "ops": edit operations, one a line, applied all or nothing. ' +
        'Operations: set <sel> key=value… [all]; rm <sel> [all]; test <sel> key=value… (refuses the whole ' +
        'changeset unless the fields hold those values); add takes a whole element as a JSON line, ' +
        '{"op":"add","element":{…}}, in the format of "elements". Selectors: a ref or id, "Label text", ' +
        'label~part, type:plan-view, selected (what the person has selected); several terms must all match. ' +
        'Keys are the fields the element format names. Values with spaces are quoted: label="Team load"; a ' +
        'value starting [ or { is JSON; key= unsets.',
    ),
};

export const shareProjectShape = {
  projectId: z.string().describe('The plan to share (from find_projects / read_project).'),
  role: z
    .enum(['view', 'participate', 'edit'])
    .optional()
    .describe(
      'What the link grants. "participate" (default): recipients work cards and Sheet cells, comment and vote ' +
        'but cannot reshape a board; right for a retro or a workshop. "view": they only look, ' +
        'with no comments or votes. "edit": they can change anything. No sign-in is needed to open any.',
    ),
  expiry: z
    .enum(['never', 'week', 'month', 'sixMonths'])
    .optional()
    .describe('When the link stops working. Defaults to "never" (until revoked).'),
};

export const deleteProjectShape = {
  projectId: z.string().describe('The plan to delete (from find_projects / read_project).'),
  tabId: z
    .string()
    .optional()
    .describe(
      'Delete only this ONE tab instead of the whole plan. A plan must keep at ' +
        'least one tab, so deleting the last remaining tab is refused. A tab is deleted ' +
        'outright; it does not go to the Trash.',
    ),
};

// The Trash (docs/specs/013-workspace/trash.md): restore one project by id.
export const restoreProjectShape = {
  projectId: z.string().describe('The plan to restore (from list_trash).'),
};

// Listing the Trash takes no arguments: it is everything the user may restore.
export const listTrashShape = {};

export const renameProjectShape = {
  projectId: z.string().describe('The plan to rename (from find_projects / read_project).'),
  name: nameField('The new name.', z.string().min(1)),
  tabId: z
    .string()
    .optional()
    .describe('Rename this tab within the plan instead of the plan itself.'),
};
