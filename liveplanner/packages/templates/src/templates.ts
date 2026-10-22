import { FORM_TEMPLATES, type FormTemplateKind } from './form-templates';
import { titleCase } from '@liveplanner/api-schema';
import { UNTITLED_PROJECT_NAME, isUntitledProjectName } from './legacy-untitled';

export type TemplateKind =
  | 'blank'
  | 'kanban'
  | 'blank-plan'
  | 'blank-spreadsheet'
  | 'project-planner'
  | 'bug-triage'
  | 'team-retro'
  | 'weekly-planner'
  | 'content-calendar'
  | 'hiring-pipeline'
  | 'okrs'
  | 'product-launch'
  | 'feedback-board'
  | 'budget-planner'
  | 'timesheet'
  | 'contact-list'
  | 'task-tracker'
  | 'invoice'
  | 'expense-report'
  | 'loan-calculator'
  | 'sales-pipeline'
  | 'inventory'
  | 'guest-list'
  | 'grade-book'
  | 'habit-tracker'
  | FormTemplateKind;

export type TemplateDescriptor = {
  kind: TemplateKind;
  title: string;
  description: string;
  // Catalogue metadata only: it marks the ten starters that shipped first,
  // and nothing gates on it. The picker used to hide extras behind a "Show
  // more" toggle; it browses by category now (docs/specs/008-canvas/canvas-and-palette.md), so every template is
  // reachable and this flag decides nothing about what a user sees.
  extra?: boolean;
  // True for templates that never appear in listings (the picker's browse
  // grids + search, the MCP list_templates catalogue) but stay buildable via
  // buildTemplate, for a dedicated entry point that names the kind directly.
  //
  // NO template sets it today (docs/specs/007-editor/templates-by-mode.md "Hidden templates"). Its one user was
  // the guided-tour sample, retired by docs/specs/007-editor/editor-tour.md's in-editor tour; the flag stays because the
  // listing paths already filter on it, so the next such entry point is a
  // one-word change rather than a new concept. `templates.test.ts` asserts
  // the set is empty, so this stays honest.
  hidden?: boolean;
  // Made in the editor only (a form template: the editor starts the form on its tab), so left out of the agents'
  // catalogue (templateCatalogue), whose creates are built on the api.
  editorOnly?: boolean;
};

export const TEMPLATES: TemplateDescriptor[] = [
  {
    kind: 'blank',
    title: 'Blank Tab',
    description: 'An empty tab: Start Planning offers a board, a sheet, a dashboard or a form.',
  },
  {
    kind: 'blank-plan',
    title: 'Blank Plan',
    description: 'An empty Plan tab: pick the board that fits the work, or build your own.',
    extra: true,
  },
  {
    kind: 'blank-spreadsheet',
    title: 'Blank Spreadsheet',
    description: 'An empty spreadsheet: cells, formulas and charts, ready to type into.',
    extra: true,
  },
  {
    kind: 'kanban',
    title: 'Kanban Board',
    description:
      'Continuous flow in three tabs: Board, with WIP limits from Backlog to Done; Requests, where new asks are accepted onto it; and Flow, a dashboard of where the work stands.',
  },
  {
    kind: 'project-planner',
    title: 'Project Planner',
    description:
      'Five tabs: a Now, Next, Later Roadmap with a Gantt chart of your projects, a Backlog of tasks by project, the Sprint board, a Daily Standup and an Overview dashboard.',
    extra: true,
  },
  {
    kind: 'bug-triage',
    title: 'Bug Tracker',
    description:
      'Three tabs: Triage new bugs by priority, follow them through Fixing to released, and watch Health on a dashboard.',
    extra: true,
  },
  {
    kind: 'team-retro',
    title: 'Team Retro',
    description:
      'Four tabs: a Retro where notes stay hidden until you reveal and vote, the Actions you agree, an Archive of past retros and an Overview dashboard.',
    extra: true,
  },
  {
    kind: 'weekly-planner',
    title: 'Weekly Planner',
    description:
      'Three tabs: This Week, a column a day; an Inbox to capture into; and a Calendar of what is due.',
    extra: true,
  },
  {
    kind: 'content-calendar',
    title: 'Content Calendar',
    description:
      'Three tabs: Ideas to vote on and approve, Production from drafting to published, and a Calendar of publish dates.',
    extra: true,
  },
  {
    kind: 'hiring-pipeline',
    title: 'Hiring Pipeline',
    description:
      'Four tabs: open Roles on a timeline, the candidate Pipeline a row per role, Onboarding for each new starter and an Overview dashboard.',
    extra: true,
  },
  {
    kind: 'okrs',
    title: 'OKRs',
    description:
      'Three tabs: Objectives on a timeline, their Key Results by objective (on track, at risk or off track) and an Overview dashboard.',
    extra: true,
  },
  {
    kind: 'product-launch',
    title: 'Product Launch',
    description:
      'Four tabs: workstreams on a Timeline, a Checklist per workstream, the Launch Day go / no-go and an Overview dashboard.',
    extra: true,
  },
  {
    kind: 'feedback-board',
    title: 'Feedback Board',
    description:
      'Three tabs: Feedback from users, voted on and reviewed, Delivery for what you plan through to shipped, and an Overview dashboard.',
    extra: true,
  },
  // Spreadsheet templates (docs/specs/026-plan/plan-templates.md "Spreadsheet templates").
  {
    kind: 'budget-planner',
    title: 'Budget Planner',
    description:
      'A spreadsheet filling the tab: planned and actual amounts by category, the difference worked out and totalled.',
    extra: true,
  },
  {
    kind: 'timesheet',
    title: 'Timesheet',
    description:
      'A spreadsheet filling the tab: this week Monday to Friday, by project and task, with the hours totalled.',
    extra: true,
  },
  {
    kind: 'contact-list',
    title: 'Contact List',
    description:
      'A spreadsheet filling the tab: names, companies, roles, emails, phones, when you last spoke and notes.',
    extra: true,
  },
  {
    kind: 'task-tracker',
    title: 'Task Tracker',
    description:
      'A spreadsheet on the canvas: tasks with owners, status, priority, dates and how much is done, beside a how-to.',
    extra: true,
  },
  {
    kind: 'invoice',
    title: 'Invoice',
    description:
      'A spreadsheet filling the tab: who it is from and to, line items with tax worked out, and the amount due.',
    extra: true,
  },
  {
    kind: 'expense-report',
    title: 'Expense Report',
    description:
      'A spreadsheet filling the tab: claims with dates and receipts, what is reimbursable, totalled by category.',
    extra: true,
  },
  {
    kind: 'loan-calculator',
    title: 'Loan Calculator',
    description:
      'A spreadsheet filling the tab: a loan’s amount, rate and term, the monthly payment and a yearly schedule.',
    extra: true,
  },
  {
    kind: 'sales-pipeline',
    title: 'Sales Pipeline',
    description:
      'A spreadsheet filling the tab: deals by stage, each weighted by its probability, with a forecast and a chart.',
    extra: true,
  },
  {
    kind: 'inventory',
    title: 'Inventory',
    description:
      'A spreadsheet filling the tab: stock on hand, its value, what is due a reorder, and a chart by item.',
    extra: true,
  },
  {
    kind: 'guest-list',
    title: 'Guest List',
    description:
      'A spreadsheet filling the tab: invitations, RSVPs, plus-ones and dietary needs, with the headcount totalled.',
    extra: true,
  },
  {
    kind: 'grade-book',
    title: 'Grade Book',
    description:
      'A spreadsheet filling the tab: each student’s scores, their average and grade, and how the class is doing.',
    extra: true,
  },
  {
    kind: 'habit-tracker',
    title: 'Habit Tracker',
    description:
      'A spreadsheet filling the tab: a week of ticks against each habit’s goal, the streaks counted and charted.',
    extra: true,
  },
  ...FORM_TEMPLATES,
];

// True when `value` names a template in the catalogue. The guard for a kind
// that arrives as a plain string from outside the type system: the MCP
// `template` argument, the `/new?template=<kind>` query (docs/specs/007-editor/new-project-route.md).
export function isTemplateKind(value: unknown): value is TemplateKind {
  return typeof value === 'string' && TEMPLATES.some((t) => t.kind === value);
}

/** The template a kind names, else null. For a kind that arrives as a plain string from outside (a link,
 *  an agent, a seed). */
export function templateKindOf(value: unknown): TemplateKind | null {
  return isTemplateKind(value) ? value : null;
}

// The editor URL that creates this template without the wizard and opens it
// (docs/specs/007-editor/new-project-route.md): what an outside surface links to, such as the marketing site's
// template gallery (docs/specs/019-marketing/marketing-site.md). The route is the editor's; the builder lives
// here so every caller spells the query the same way `isTemplateKind` reads.
export function templateCreateHref(kind: TemplateKind): string {
  return `/new?template=${encodeURIComponent(kind)}`;
}

// Default name for a freshly-created project: "Untitled <Template Title>" in
// title case so a templated project is recognisable in the Explorer (e.g.
// "Untitled Kanban Board"), while a blank one (or no template) keeps the plain
// "Untitled project" (UNTITLED_PROJECT_NAME, legacy-untitled.ts).

export function untitledNameForTemplate(kind: TemplateKind | null): string {
  if (!kind || kind === 'blank') return UNTITLED_PROJECT_NAME;
  // A blank names what it makes ("Untitled Spreadsheet"), not the card ("Blank Spreadsheet").
  const title = TEMPLATES.find((t) => t.kind === kind)?.title.replace(/^Blank /, '');
  return title ? `Untitled ${titleCase(title)}` : UNTITLED_PROJECT_NAME;
}

// Every name a project is given before anyone names it: each template's untitled name, plus "Untitled project" and
// its legacy spelling. Built once, at first use.
let DEFAULT_NAMES: ReadonlySet<string> | null = null;

/**
 * Whether a project still has a default name (docs/specs/007-editor/templates-by-mode.md "The project's name"), so a
 * template picked on its first tab may name it after itself. A name someone gave it is never default.
 */
export function isDefaultProjectName(name: string): boolean {
  DEFAULT_NAMES ??= new Set(TEMPLATES.map((t) => untitledNameForTemplate(t.kind)));
  return isUntitledProjectName(name) || DEFAULT_NAMES.has(name);
}
