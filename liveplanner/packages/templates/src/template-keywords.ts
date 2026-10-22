// The words people search for a template by, beyond its title and description (docs/specs/008-canvas/canvas-and-palette.md
// "Template categories", Search): other names for it and the job it does. Pure data. A spreadsheet template adds to
// its sheet's own words (@liveplanner/sheets SheetTemplateInfo.keywords, which Start Planning searches too), so the
// Quick Start and Start Planning find a sheet by the same words.
import { TEMPLATE_START_SHEETS, sheetTemplateInfo } from '@liveplanner/sheets';
import type { TemplateKind } from './templates';

const OWN_KEYWORDS: Readonly<Record<TemplateKind, readonly string[]>> = {
  // The blanks.
  blank: ['empty', 'scratch', 'new', 'canvas', 'nothing'],
  'blank-plan': ['empty', 'board', 'cards', 'tasks', 'sheet'],
  'blank-spreadsheet': ['empty', 'sheet', 'spreadsheet', 'excel', 'grid', 'cells', 'table'],
  // Planning.
  'project-planner': [
    'project',
    'sprint',
    'scrum',
    'standup',
    'backlog',
    'roadmap',
    'gantt',
    'agile',
    'pm',
  ],
  kanban: [
    'agile',
    'board',
    'workflow',
    'tasks',
    'todo',
    'to do',
    'wip',
    'trello',
    'requests',
    'pipeline',
  ],
  'task-tracker': ['tasks', 'to do', 'todo', 'checklist', 'owners', 'status', 'due dates', 'list'],
  'bug-triage': [
    'bugs',
    'issues',
    'defects',
    'qa',
    'support',
    'tickets',
    'jira',
    'triage',
    'health',
  ],
  'weekly-planner': ['week', 'schedule', 'calendar', 'days', 'routine', 'personal', 'agenda'],
  'content-calendar': [
    'marketing',
    'social',
    'posts',
    'blog',
    'editorial',
    'schedule',
    'publish',
    'calendar',
  ],
  'product-launch': ['release', 'launch', 'go to market', 'gtm', 'checklist', 'ship', 'go no go'],
  'hiring-pipeline': [
    'recruiting',
    'hiring',
    'candidates',
    'interviews',
    'jobs',
    'hr',
    'onboarding',
    'ats',
  ],
  okrs: ['objectives', 'key results', 'goals', 'targets', 'kpi', 'quarter', 'okr'],
  // Finance (the sheets' own words come from their sheet template).
  'budget-planner': ['budget', 'personal finance'],
  timesheet: ['time tracking', 'payroll', 'invoice hours'],
  invoice: ['receipt', 'payment request', 'small business'],
  'expense-report': ['expenses', 'expense claim', 'reimburse'],
  'loan-calculator': ['loan', 'emi', 'apr', 'debt'],
  'sales-pipeline': ['pipeline', 'deals', 'sales funnel', 'kpi'],
  // Spreadsheets.
  'contact-list': ['contacts', 'leads', 'directory'],
  inventory: ['stock control', 'stocktake', 'catalogue'],
  'guest-list': ['guests', 'rsvp list', 'invite list'],
  'grade-book': ['grades', 'report card', 'exam'],
  'habit-tracker': ['habits', 'self improvement', 'fitness'],
  // Form templates (form-templates.ts).
  'blank-form': ['empty', 'survey', 'questionnaire', 'responses', 'sign up'],
  'bug-report-form': ['bug', 'issue', 'report', 'support', 'triage', 'survey'],
  'feedback-form': ['feedback', 'survey', 'rating', 'satisfaction', 'nps', 'questionnaire'],
  'feature-request-form': ['feature', 'idea', 'request', 'suggestion', 'roadmap', 'survey'],
  'rsvp-form': ['rsvp', 'event', 'invite', 'attendance', 'party', 'guest', 'sign up'],
  'job-application-form': ['job', 'application', 'hiring', 'candidate', 'recruitment', 'careers'],
  'contact-form': ['contact', 'enquiry', 'inquiry', 'message', 'support', 'get in touch'],
  'team-retro': [
    'retro',
    'retrospective',
    'actions',
    'feedback',
    'vote',
    'sprint',
    'archive',
    'team',
  ],
  'feedback-board': [
    'feedback',
    'feature requests',
    'ideas',
    'votes',
    'customers',
    'roadmap',
    'suggestions',
  ],
};

// The templates made with a sheet template, by kind (their start's sheet): the spreadsheet templates and the three
// companion Sheets (template-companions.ts).
const SHEET_STARTS_BY_KIND = TEMPLATE_START_SHEETS as Readonly<Record<string, unknown>>;

/** The words a template is searched by: its own, and for a template made with a sheet template (a spreadsheet
 *  template, or a Diagram template's companion Sheet) its sheet's too. */
export function templateKeywords(kind: TemplateKind): readonly string[] {
  const own = OWN_KEYWORDS[kind];
  if (!(kind in SHEET_STARTS_BY_KIND)) return own;
  const sheet = sheetTemplateInfo(
    TEMPLATE_START_SHEETS[kind as keyof typeof TEMPLATE_START_SHEETS],
  ).keywords;
  return [...new Set([...own, ...sheet])];
}
