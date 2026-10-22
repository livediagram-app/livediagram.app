// What Start Planning offers (docs/specs/026-plan/plan-mode.md "Starting a board"): every board type, sheet start and
// Dashboard layout as one list of cards, the rail's categories over it, the Recommended pick, and the search across
// all of them. Pure: the panel draws what these return.
import {
  ITEM_TYPES,
  PLAN_BOARD_PRESETS,
  PLAN_PALETTE_VISUALISATIONS,
  READY_MADE_CARD_TYPES,
  boardAddTypes,
  type PlanVisualisation,
  type PlanBoardPresetId,
} from '@livepages/items';
import { DASHBOARD_PRESETS, type DashboardPresetId } from '@livepages/document';
import {
  PLAN_TEMPLATE_KINDS,
  TEMPLATES,
  isSpreadsheetPlanTemplate,
  planTemplateTabCount,
  templateKeywords,
  type PlanTemplateKind,
} from '@livepages/templates';
import { PLAN_BOARD_TILES } from '@/components/palette/palette-plan-tiles';
import { VISUALISATION_INFO } from '@/components/palette/palette-plan-view-tiles';
import type { SuggestedDashboard } from '@/lib/suggested-dashboards';
import { SHEET_TEMPLATES } from '@livepages/sheets';
import { FORM_STARTERS, type StarterId } from '@livepages/forms';
import type { PlacedSheetStart } from '@/lib/sheet-seeds';

export type StartKind = 'board' | 'sheet' | 'form' | 'visualisation' | 'dashboard' | 'template';

export type StartItem = {
  id: string;
  kind: StartKind;
  name: string;
  line: string;
  // A board's card types (its chips), or what it says instead (Blank: You Choose; All Cards: Every Card).
  types?: { label: string; color: string }[];
  typesNote?: string;
  // A template's tab count (its badge).
  tabs?: number;
  // Words people look for it by, beyond its name and line (START_KEYWORDS).
  keywords?: readonly string[];
} & (
  | { kind: 'board'; preset: PlanBoardPresetId }
  | { kind: 'sheet'; start: PlacedSheetStart | null }
  // A form, from one of its starters (docs/specs/030-forms/forms.md "Starting a form").
  | { kind: 'form'; starter: StarterId }
  | { kind: 'dashboard'; layout: DashboardPresetId; suggestion?: undefined }
  // A Dashboard built around the document's own boards and sheets (suggested-dashboards.ts).
  | { kind: 'dashboard'; suggestion: SuggestedDashboard; layout?: undefined }
  // One chart filling the tab (Visualisations).
  | { kind: 'visualisation'; view: PlanVisualisation }
  // A Plan template: a way of working set up across tabs (Inspiration).
  | { kind: 'template'; template: PlanTemplateKind }
);

export type StartCategory =
  'recommended' | 'boards' | 'sheets' | 'forms' | 'visualisations' | 'dashboards' | 'inspiration';

export const START_CATEGORIES: readonly { id: StartCategory; name: string; line: string }[] = [
  {
    id: 'recommended',
    name: 'Recommended',
    line: 'The quickest ways to start, picked for most teams.',
  },
  { id: 'boards', name: 'Boards', line: 'Columns of cards for the work to move through.' },
  { id: 'sheets', name: 'Spreadsheets', line: 'Cells, formulas and charts, beside your boards.' },
  {
    id: 'forms',
    name: 'Forms',
    line: 'A form anyone can fill in from a link. Each response becomes a card on a board or a row in a sheet.',
  },
  {
    id: 'visualisations',
    name: 'Visualisations',
    line: 'One chart filling the tab, read live from every card: a Gantt chart, a due calendar and more.',
  },
  {
    id: 'dashboards',
    name: 'Dashboards',
    line: 'Your boards, sheets and charts side by side, in rows of slots.',
  },
  {
    id: 'inspiration',
    name: 'Inspiration',
    line: 'Ready-made ways to run real work, from hiring to launches, set up across tabs for you.',
  },
];

// The order Inspiration leads with, the most eye-opening first.
const INSPIRATION_ORDER: readonly PlanTemplateKind[] = [
  'hiring-pipeline',
  'content-calendar',
  'product-launch',
  'okrs',
  'feedback-board',
  'project-planner',
  'bug-triage',
  'team-retro',
  'weekly-planner',
  'kanban',
];

// Inspiration's Plan templates: every Plan template the Quick Start and /new offer that sets up work across tabs
// (Blank Plan, a start of nothing, is left out, and so is a spreadsheet template that makes one tab: it is one Sheet
// that Spreadsheets already offers, so no choice shows twice; one that sets up more, such as Task Tracker's Sheet and
// its Overview, stays; docs/specs/026-plan/plan-mode.md "Starting a board"). Drawn from the catalogue, so a new
// template joins Inspiration at the end unless INSPIRATION_ORDER places it.
const inInspiration = (k: PlanTemplateKind) =>
  k !== 'blank-plan' && !(isSpreadsheetPlanTemplate(k) && planTemplateTabCount(k) === 1);
export const INSPIRATION_TEMPLATES: readonly PlanTemplateKind[] = [
  ...INSPIRATION_ORDER.filter((k) => (PLAN_TEMPLATE_KINDS as readonly string[]).includes(k)),
  ...PLAN_TEMPLATE_KINDS.filter((k) => inInspiration(k) && !INSPIRATION_ORDER.includes(k)),
].filter(inInspiration);

// The words people search for each choice by, beyond its name and line: what it is for, the work it suits and other
// names for it (a Kanban is also a pipeline, a task board, an agile board).
const START_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  'board:blank': ['custom', 'empty', 'scratch', 'own columns', 'build'],
  'board:kanban': [
    'agile',
    'workflow',
    'pipeline',
    'tasks',
    'wip',
    'flow',
    'todo',
    'progress',
    'lean',
  ],
  'board:todo': ['checklist', 'tasks', 'list', 'personal', 'simple', 'actions', 'chores'],
  'board:sprint': [
    'scrum',
    'agile',
    'iteration',
    'stories',
    'estimates',
    'points',
    'velocity',
    'team',
  ],
  'board:retro': [
    'retrospective',
    'feedback',
    'lessons',
    'went well',
    'improve',
    'vote',
    'ideas',
    'team',
  ],
  'board:roadmap': [
    'plan',
    'strategy',
    'now next later',
    'projects',
    'priorities',
    'quarters',
    'product',
  ],
  'board:bug-triage': [
    'bugs',
    'issues',
    'defects',
    'qa',
    'support',
    'tickets',
    'priority',
    'tracker',
  ],
  'board:weekly': ['week', 'schedule', 'calendar', 'days', 'monday', 'planner', 'routine'],
  'board:all-cards': ['everything', 'overview', 'every card', 'status', 'all work'],
  'sheet:blank': ['grid', 'table', 'cells', 'spreadsheet', 'excel', 'data', 'empty'],
  'sheet:cards': ['export', 'cards as rows', 'linked', 'table', 'report', 'data'],
  'visualisation:gantt': ['timeline', 'schedule', 'dates', 'projects', 'roadmap', 'full screen'],
  'visualisation:calendar': ['dates', 'deadlines', 'due', 'month', 'schedule', 'full screen'],
  'visualisation:start-calendar': [
    'dates',
    'start',
    'begin',
    'kick off',
    'month',
    'schedule',
    'full screen',
  ],
  'visualisation:workload': [
    'people',
    'capacity',
    'assignee',
    'bar chart',
    'who',
    'status',
    'breakdown',
    'full screen',
  ],
  'visualisation:priority-matrix': ['urgent', 'priorities', 'heatmap', 'triage', 'full screen'],
  'visualisation:search': ['filter', 'list', 'find', 'query', 'cards', 'full screen'],
  'dashboard:two-by-two': ['grid', 'four', 'even', 'simple'],
  'dashboard:overview': ['metrics', 'charts', 'summary', 'report', 'status', 'kpi'],
  'dashboard:focus': ['board', 'wide', 'side panel', 'work'],
  'dashboard:three-columns': ['columns', 'six', 'compare'],
  'dashboard:stacked': ['rows', 'full width', 'long', 'scroll'],
  'dashboard:report': ['metrics', 'charts', 'summary', 'stakeholders', 'update', 'kpi'],
};

// Recommended, in order.
const RECOMMENDED_IDS = [
  'board:roadmap',
  'board:kanban',
  'board:todo',
  'dashboard:overview',
  'sheet:blank',
  'form:feedback',
] as const;

// The sheet starts, in Start Planning's order: the empty sheet, the card table (only with cards), then every sheet
// template (docs/specs/029-sheets/sheet.md "Sheet templates").
export const SHEET_STARTS: readonly {
  start: PlacedSheetStart | null;
  name: string;
  line: string;
  keywords?: readonly string[];
}[] = [
  { start: null, name: 'Empty Sheet', line: 'A blank grid, ready to type into.' },
  {
    start: 'cards',
    name: 'Card Table',
    line: 'Your cards of a type as rows, linked both ways. Pick which next.',
  },
  // A sheet template's search words are its own (shared with the Quick Start's search for its Plan template).
  ...SHEET_TEMPLATES.map((t) => ({
    start: t.id,
    name: t.name,
    line: t.line,
    keywords: t.keywords,
  })),
];

// A board's card types, as its chips: its preset's own (a Bug Triage board's Bugs), else the five defaults.
function boardTypes(preset: PlanBoardPresetId): Pick<StartItem, 'types' | 'typesNote'> {
  if (preset === 'blank') return { typesNote: 'You Choose' };
  const setup = PLAN_BOARD_PRESETS[preset].setup;
  if (setup.allCards) return { typesNote: 'Every Card' };
  const types = boardAddTypes(setup, setup.addTypes ? READY_MADE_CARD_TYPES : ITEM_TYPES);
  return { types: types.map((t) => ({ label: t.label, color: t.color })) };
}

export function startItems({
  hasCards,
  suggestions = [],
}: {
  hasCards: boolean;
  suggestions?: readonly SuggestedDashboard[];
}): StartItem[] {
  const boards: StartItem[] = PLAN_BOARD_TILES.filter((t) => t.preset !== 'archive').map((t) => ({
    id: `board:${t.preset}`,
    kind: 'board',
    preset: t.preset,
    name: PLAN_BOARD_PRESETS[t.preset].label.replace(/ Board$/, ''),
    line: t.description,
    ...boardTypes(t.preset),
  }));
  const sheets: StartItem[] = SHEET_STARTS.filter((s) => s.start !== 'cards' || hasCards).map(
    (s) => ({
      id: `sheet:${s.start ?? 'blank'}`,
      kind: 'sheet',
      start: s.start,
      name: s.name,
      line: s.line,
      ...(s.keywords ? { keywords: s.keywords } : {}),
    }),
  );
  const forms: StartItem[] = FORM_STARTERS.map((f) => ({
    id: `form:${f.id}`,
    kind: 'form',
    starter: f.id,
    name: f.name,
    line: f.line,
    keywords: [
      'form',
      'survey',
      'questionnaire',
      'responses',
      'submissions',
      'intake',
      'google forms',
    ],
  }));
  // Status Breakdown is retired: Start Planning never makes one (plan-views.md "Visualisations").
  const visualisations: StartItem[] = PLAN_PALETTE_VISUALISATIONS.map((v) => ({
    id: `visualisation:${v}`,
    kind: 'visualisation',
    view: v,
    name: VISUALISATION_INFO[v].caption,
    line: VISUALISATION_INFO[v].description,
  }));
  const suggested: StartItem[] = suggestions.map((s) => ({
    id: `suggested:${s.id}`,
    kind: 'dashboard',
    suggestion: s,
    name: s.name,
    line: s.line,
    types: s.holds.map((h) => ({ label: h, color: '' })),
    keywords: ['suggested', 'yours', 'built', 'ready'],
  }));
  const dashboards: StartItem[] = DASHBOARD_PRESETS.map((p) => ({
    id: `dashboard:${p.id}`,
    kind: 'dashboard',
    layout: p.id,
    name: p.name,
    line: p.line,
  }));
  const templates: StartItem[] = INSPIRATION_TEMPLATES.flatMap((kind) => {
    const t = TEMPLATES.find((d) => d.kind === kind);
    return t
      ? [
          {
            id: `template:${kind}`,
            kind: 'template',
            template: kind,
            name: t.title,
            line: t.description,
            tabs: planTemplateTabCount(kind),
            // The Quick Start's search words for it, so both pickers find it alike.
            keywords: templateKeywords(kind),
          },
        ]
      : [];
  });
  return [
    ...boards,
    ...sheets,
    ...forms,
    ...visualisations,
    ...suggested,
    ...dashboards,
    ...templates,
  ].map((i) => (START_KEYWORDS[i.id] ? { ...i, keywords: START_KEYWORDS[i.id] } : i));
}

const KIND_OF: Record<Exclude<StartCategory, 'recommended'>, StartKind> = {
  boards: 'board',
  sheets: 'sheet',
  forms: 'form',
  visualisations: 'visualisation',
  dashboards: 'dashboard',
  inspiration: 'template',
};

export const KIND_NAMES: Record<StartKind, string> = {
  board: 'Board',
  sheet: 'Sheet',
  form: 'Form',
  visualisation: 'Chart',
  dashboard: 'Dashboard',
  template: 'Template',
};

// What a category shows.
export function itemsIn(items: readonly StartItem[], category: StartCategory): StartItem[] {
  if (category === 'recommended') {
    // A Dashboard built from the document's work, when there is one, in the Overview layout's place.
    const suggested = items.find((i) => i.id.startsWith('suggested:'));
    return RECOMMENDED_IDS.flatMap((id) =>
      id === 'dashboard:overview' && suggested ? [suggested] : items.filter((i) => i.id === id),
    );
  }
  return items.filter((i) => i.kind === KIND_OF[category]);
}

// The items a search matches, by name, line, kind and a board's card types (case and spacing ignored), grouped by
// kind in the rail's order.
export function searchStartItems(
  items: readonly StartItem[],
  query: string,
): { category: StartCategory; items: StartItem[] }[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const hay = (i: StartItem) =>
    [
      i.name,
      i.line,
      KIND_NAMES[i.kind],
      i.typesNote ?? '',
      ...(i.types ?? []).map((t) => t.label),
      ...(i.keywords ?? []),
    ]
      .join(' ')
      .toLowerCase();
  const found = items.filter((i) => words.every((w) => hay(i).includes(w)));
  return (['boards', 'sheets', 'forms', 'visualisations', 'dashboards', 'inspiration'] as const)
    .map((category) => ({ category, items: found.filter((i) => i.kind === KIND_OF[category]) }))
    .filter((g) => g.items.length > 0);
}
