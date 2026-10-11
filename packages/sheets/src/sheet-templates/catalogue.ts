// The sheet templates (docs/specs/029-sheets/sheet.md "Sheet templates"): every designed sheet a person can start
// from, in Setup Sheet's and Start Planning's order, each with its name, line, group and accent, and its design dated
// from now. One catalogue: Setup Sheet, Start Planning, a Dashboard slot and the Plan templates all draw from it.
import { localMs, serialFromMs } from '../dates';
import type { SheetAccent } from './accents';
import type { SheetDesign } from './design';
import { budgetDesign, expensesDesign, invoiceDesign, loanDesign } from './money';
import { contactsDesign, gradesDesign, guestsDesign, habitsDesign } from './people';
import { inventoryDesign, pipelineDesign, timesheetDesign, trackerDesign } from './work';

export const SHEET_TEMPLATE_IDS = [
  'budget',
  'tracker',
  'timesheet',
  'contacts',
  'invoice',
  'expenses',
  'pipeline',
  'inventory',
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

// A template's design, dated from `now` (the Timesheet's week, the Tracker's and Contacts' dates, the Invoice's day):
// the instant `now` in this person's time zone, so its today is TODAY()'s (a template made just after midnight is
// dated that day, not the day before).
export function sheetTemplate(id: SheetTemplateId, nowMs: number): SheetDesign {
  const now = localMs(nowMs);
  const today = Math.floor(serialFromMs(now));
  switch (id) {
    case 'budget':
      return budgetDesign();
    case 'tracker':
      return trackerDesign(today);
    case 'timesheet':
      return timesheetDesign(now);
    case 'contacts':
      return contactsDesign(today);
    case 'invoice':
      return invoiceDesign(today);
    case 'expenses':
      return expensesDesign(today);
    case 'pipeline':
      return pipelineDesign(today);
    case 'inventory':
      return inventoryDesign();
    case 'guests':
      return guestsDesign();
    case 'grades':
      return gradesDesign();
    case 'habits':
      return habitsDesign();
    case 'loan':
      return loanDesign();
  }
}
