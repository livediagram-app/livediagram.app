// Template starts (docs/specs/029-sheets/sheet-store.md "Template starts"; the templates in
// docs/specs/026-plan/plan-templates.md "Spreadsheet templates"): the sheets a Plan template's Sheet is made from.
// `templateSheet` builds one whole; @livediagram/templates' materialiseTemplateSheets turns a tab's marked Sheet
// elements into them, and the editor makes one only when a path missed it.
import { emptyLayout, emptySheet, NOBODY } from './sheet';
import { sheetToJson } from './sheet-json';
import { serialFromMs } from './dates';
import { applySheetWrite } from './store';
import { setupWrite, type SheetStarter, type StarterCell } from './sheet-starters';
import { Workbook } from './engine/workbook';
import type { Rand } from './ids';
import type { SheetJson } from './sheet-json';

export const TEMPLATE_STARTS = [
  'budget-planner',
  'timesheet',
  'contact-list',
  'task-tracker',
] as const;
export type TemplateStartId = (typeof TEMPLATE_STARTS)[number];

export function isTemplateStart(id: unknown): id is TemplateStartId {
  return typeof id === 'string' && (TEMPLATE_STARTS as readonly string[]).includes(id);
}

// The sheet's title, then its cells: the first row the header.
export type TemplateStart = { title: string; start: SheetStarter };

const DAY_MS = 86_400_000;
const date = (serial: number): StarterCell => ({ n: serial, date: true });
const TWO_DP = { nf: 'number', dp: 2 } as const;

// A template start, dated from `now` (the Timesheet's week, the Tracker's and Contacts' dates).
export function templateStart(id: TemplateStartId, now: number): TemplateStart {
  const today = Math.floor(serialFromMs(now));
  switch (id) {
    case 'budget-planner': {
      const items: [string, string, number, number][] = [
        ['Home', 'Rent', 1200, 1200],
        ['Home', 'Utilities', 180, 164],
        ['Food', 'Groceries', 350, 382],
        ['Travel', 'Transport', 140, 120],
        ['Leisure', 'Eating Out', 120, 96],
        ['Savings', 'Emergency Fund', 300, 300],
        ['Other', 'Subscriptions', 45, 52],
      ];
      const last = items.length + 1;
      return {
        title: 'Budget',
        start: {
          rows: [
            ['Category', 'Item', 'Planned', 'Actual', 'Difference'],
            ...items.map(([cat, item, plan, actual], i): StarterCell[] => [
              cat,
              item,
              String(plan),
              String(actual),
              `=C${i + 2}-D${i + 2}`,
            ]),
            ['Total', null, `=SUM(C2:C${last})`, `=SUM(D2:D${last})`, `=SUM(E2:E${last})`],
          ],
          widths: [140, 180, 120, 120, 120],
          total: true,
          formats: [2, 3, 4].map((col) => ({ col, patch: TWO_DP })),
        },
      };
    }
    case 'timesheet': {
      // Monday of the week it is made.
      const back = (new Date(now).getUTCDay() + 6) % 7;
      const monday = Math.floor(serialFromMs(now - back * DAY_MS));
      const days: [string, string, string, string][] = [
        ['Monday', 'Website', 'Planning', '7.5'],
        ['Tuesday', 'Website', 'Build', '8'],
        ['Wednesday', 'Research', 'Interviews', '6'],
        ['Thursday', 'Website', 'Build', '7.5'],
        ['Friday', 'Research', 'Write-up', '5'],
      ];
      return {
        title: 'Timesheet',
        start: {
          rows: [
            ['Day', 'Date', 'Project', 'Task', 'Hours'],
            ...days.map(([day, project, task, hours], i): StarterCell[] => [
              day,
              date(monday + i),
              project,
              task,
              hours,
            ]),
            ['Total', null, null, null, '=SUM(E2:E6)'],
          ],
          widths: [130, 120, 160, 180, 100],
          total: true,
        },
      };
    }
    case 'contact-list':
      return {
        title: 'Contacts',
        start: {
          rows: [
            ['Name', 'Company', 'Role', 'Email', 'Phone', 'Last Contacted', 'Notes'],
            [
              'Jordan Lee',
              'Northwind',
              'Head of Design',
              { s: 'jordan@example.com' },
              { s: '+44 20 7946 0000' },
              date(today - 3),
              'Sent the proposal',
            ],
            [
              'Priya Shah',
              'Contoso',
              'Product Manager',
              { s: 'priya@example.com' },
              { s: '+44 161 496 0000' },
              date(today - 10),
              'Follow up on pricing',
            ],
            [
              'Sam Okafor',
              'Fabrikam',
              'Engineering Lead',
              { s: 'sam@example.com' },
              { s: '+44 117 496 0000' },
              date(today - 21),
              'Met at the conference',
            ],
            [
              'Alex Moreau',
              'Tailspin',
              'Founder',
              { s: 'alex@example.com' },
              { s: '+44 131 496 0000' },
              date(today - 35),
              'Intro from Priya',
            ],
          ],
          widths: [150, 130, 150, 200, 160, 130, 220],
        },
      };
    case 'task-tracker': {
      const tasks: [string, string, string, string, number, number, string][] = [
        ['Agree the scope', 'Alex', 'Done', 'High', -7, -2, '100%'],
        ['Draft the plan', 'Sam', 'In Progress', 'High', -2, 5, '60%'],
        ['Review with the team', 'Priya', 'To Do', 'Medium', 5, 9, '0%'],
        ['Build the first version', 'Jordan', 'To Do', 'Medium', 9, 23, '0%'],
        ['Share the results', 'Alex', 'To Do', 'Low', 23, 26, '0%'],
      ];
      return {
        title: 'Tracker',
        start: {
          rows: [
            ['Task', 'Owner', 'Status', 'Priority', 'Start', 'Due', 'Done'],
            ...tasks.map(([task, owner, status, priority, from, to, done]): StarterCell[] => [
              task,
              owner,
              status,
              priority,
              date(today + from),
              date(today + to),
              done,
            ]),
          ],
          widths: [220, 110, 120, 100, 110, 110, 90],
          // Done reads as a whole percentage.
          formats: [{ col: 6, patch: { nf: 'percent', dp: 0 } }],
        },
      };
    }
  }
}

// The sheet a template start makes (what a create request carries): set up as Setup Sheet would (the Header look, the header row
// frozen, the default cell size, tints for a light or dark canvas). Null if the start's cells cannot be read (a
// formula the engine refuses: a bug in the start, caught by its test).
export function templateSheet(opts: {
  id: string;
  tabId: string;
  start: TemplateStartId;
  now: number;
  dark: boolean;
  rand?: Rand;
}): Pick<SheetJson, 'id' | 'tabId' | 'title' | 'layout' | 'cells'> | null {
  const { id, tabId, now, dark, rand = Math.random } = opts;
  const { title, start } = templateStart(opts.start, now);
  const blank = emptySheet({ id, tabId, title, layout: emptyLayout(rand), now });
  const wb = new Workbook({ sheets: [blank], locale: 'en-GB' });
  const write = setupWrite(
    wb,
    id,
    { start, look: 'header', freezeHeader: true, size: 'default', dark },
    rand,
  );
  if (!write) return null;
  const json = sheetToJson(applySheetWrite(blank, write, { now, by: NOBODY }).sheet);
  return { id, tabId, title, layout: json.layout, cells: json.cells };
}
