// The sheet templates (docs/specs/029-sheets/sheet.md "Sheet templates"): every designed sheet a person can start
// from, in Setup Sheet's and Start Planning's order, each with its name, line, group and accent, and its design dated
// from now. One catalogue: Setup Sheet, Start Planning, a Dashboard slot and the Plan templates all draw from it.
// Names and lines only, so the main bundle can name a template without carrying its design (template-design.ts).
import type { SheetAccent } from './accents';

export const SHEET_TEMPLATE_IDS = [
  'budget',
  'tracker',
  'timesheet',
  'contacts',
  'invoice',
  'expenses',
  'pipeline',
  'inventory',
  'threats',
  'drivers',
  'value-stream',
  'guests',
  'grades',
  'habits',
  'loan',
] as const;
export type SheetTemplateId = (typeof SHEET_TEMPLATE_IDS)[number];

export function isSheetTemplateId(v: unknown): v is SheetTemplateId {
  return typeof v === 'string' && (SHEET_TEMPLATE_IDS as readonly string[]).includes(v);
}

// What a sheet can start from in Setup Sheet beyond Plan Cards and a CSV: nothing, or a template.
export const SHEET_STARTS = ['blank', ...SHEET_TEMPLATE_IDS] as const;
export type SheetStartId = (typeof SHEET_STARTS)[number];

// Setup Sheet's headings over its templates.
export const SHEET_TEMPLATE_GROUPS = ['Money', 'Work', 'People and Life'] as const;
export type SheetTemplateGroup = (typeof SHEET_TEMPLATE_GROUPS)[number];

export type SheetTemplateInfo = {
  id: SheetTemplateId;
  name: string;
  line: string;
  group: SheetTemplateGroup;
  accent: SheetAccent;
  // The chart it places, which its preview art draws.
  chart?: 'pie-chart' | 'bar-chart' | 'line-chart';
  // Words people search for it by, beyond its name and line (Start Planning's search, and the template picker's for
  // the Plan template made from it: docs/specs/008-canvas/canvas-and-palette.md "Template categories").
  keywords: readonly string[];
};

export const SHEET_TEMPLATES: readonly SheetTemplateInfo[] = [
  {
    id: 'budget',
    name: 'Budget',
    line: 'Planned against actual, a summary and spending by category.',
    group: 'Money',
    accent: 'emerald',
    chart: 'pie-chart',
    keywords: [
      'money',
      'costs',
      'expenses',
      'finance',
      'spend',
      'total',
      'accounts',
      'household',
      'monthly',
      'income',
    ],
  },
  {
    id: 'tracker',
    name: 'Tracker',
    line: 'Tasks, owners, status, due dates and progress.',
    group: 'Work',
    accent: 'violet',
    chart: 'bar-chart',
    keywords: ['tasks', 'owners', 'status', 'due dates', 'progress', 'list', 'project'],
  },
  {
    id: 'timesheet',
    name: 'Timesheet',
    line: 'This week’s hours, billable time and the amount to bill.',
    group: 'Work',
    accent: 'sky',
    chart: 'pie-chart',
    keywords: ['hours', 'time', 'billing', 'billable', 'work log', 'week', 'rate', 'freelance'],
  },
  {
    id: 'contacts',
    name: 'Contacts',
    line: 'People, companies and who is due a follow-up.',
    group: 'People and Life',
    accent: 'indigo',
    keywords: [
      'people',
      'crm',
      'address book',
      'clients',
      'customers',
      'follow up',
      'email',
      'phone',
    ],
  },
  {
    id: 'invoice',
    name: 'Invoice',
    line: 'Line items, tax and the amount due, ready to send.',
    group: 'Money',
    accent: 'blue',
    keywords: [
      'bill',
      'billing',
      'payment',
      'tax',
      'vat',
      'client',
      'quote',
      'estimate',
      'freelance',
    ],
  },
  {
    id: 'expenses',
    name: 'Expense Report',
    line: 'Claims, receipts and what is reimbursable.',
    group: 'Money',
    accent: 'amber',
    chart: 'pie-chart',
    keywords: ['claims', 'receipts', 'reimbursement', 'travel', 'costs', 'spending', 'money'],
  },
  {
    id: 'pipeline',
    name: 'Sales Pipeline',
    line: 'Deals by stage, weighted by probability, with a forecast.',
    group: 'Work',
    accent: 'teal',
    chart: 'bar-chart',
    keywords: [
      'sales',
      'crm',
      'deals',
      'forecast',
      'revenue',
      'leads',
      'opportunities',
      'win rate',
    ],
  },
  {
    id: 'inventory',
    name: 'Inventory',
    line: 'Stock, its value and what to reorder.',
    group: 'Work',
    accent: 'orange',
    chart: 'bar-chart',
    keywords: ['stock', 'products', 'warehouse', 'reorder', 'items', 'sku', 'supplies', 'assets'],
  },
  {
    id: 'threats',
    name: 'Threat Register',
    line: 'Threats by STRIDE, scored, rated and tracked to mitigated.',
    group: 'Work',
    accent: 'rose',
    chart: 'bar-chart',
    keywords: [
      'threat model',
      'stride',
      'security',
      'risks',
      'vulnerabilities',
      'mitigation',
      'appsec',
      'register',
    ],
  },
  {
    id: 'drivers',
    name: 'Driver Model',
    line: 'A north-star metric worked from its inputs, with what-ifs.',
    group: 'Work',
    accent: 'indigo',
    chart: 'bar-chart',
    keywords: [
      'metric tree',
      'north star',
      'kpi',
      'what if',
      'scenario',
      'growth model',
      'levers',
      'forecast',
    ],
  },
  {
    id: 'value-stream',
    name: 'Value Stream',
    line: 'Steps, waits and lead time, with flow efficiency worked out.',
    group: 'Work',
    accent: 'teal',
    chart: 'bar-chart',
    keywords: [
      'value stream map',
      'vsm',
      'lead time',
      'cycle time',
      'flow efficiency',
      'lean',
      'bottleneck',
      'devops',
    ],
  },
  {
    id: 'guests',
    name: 'Guest List',
    line: 'Invitations, RSVPs, dietary needs and the headcount.',
    group: 'People and Life',
    accent: 'rose',
    chart: 'pie-chart',
    keywords: [
      'event',
      'party',
      'wedding',
      'rsvp',
      'invitations',
      'attendees',
      'headcount',
      'seating',
    ],
  },
  {
    id: 'grades',
    name: 'Grade Book',
    line: 'Scores, averages, grades and how the class is doing.',
    group: 'People and Life',
    accent: 'purple',
    chart: 'bar-chart',
    keywords: ['school', 'students', 'class', 'scores', 'marks', 'teacher', 'gradebook', 'results'],
  },
  {
    id: 'habits',
    name: 'Habit Tracker',
    line: 'A week of ticks against each habit’s goal.',
    group: 'People and Life',
    accent: 'fuchsia',
    chart: 'bar-chart',
    keywords: ['routine', 'goals', 'daily', 'weekly', 'health', 'streak', 'checklist', 'personal'],
  },
  {
    id: 'loan',
    name: 'Loan Calculator',
    line: 'The monthly payment and a year-by-year schedule.',
    group: 'Money',
    accent: 'cyan',
    chart: 'line-chart',
    keywords: [
      'mortgage',
      'repayment',
      'interest',
      'calculator',
      'amortisation',
      'amortization',
      'finance',
      'payment',
    ],
  },
];

export function sheetTemplateInfo(id: SheetTemplateId): SheetTemplateInfo {
  return SHEET_TEMPLATES.find((t) => t.id === id)!;
}
