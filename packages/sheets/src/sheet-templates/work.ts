// The work templates (docs/specs/029-sheets/sheet.md "Sheet templates"): Tracker, Timesheet, Sales Pipeline and
// Inventory. Example rows worked by live formulas: type over them and the totals, summary and chart follow.
import {
  CENTRE,
  DATE,
  HEAD_ROW,
  MONEY,
  NUMBER1,
  PERCENT,
  WHOLE,
  WHOLE_MONEY,
  day,
  text,
  type SheetDesign,
} from './design';
import type { StarterCell } from '../sheet-starters';
import { serialFromMs } from '../dates';

export function trackerDesign(today: number): SheetDesign {
  const tasks: [string, string, string, string, number, number, string][] = [
    ['Agree the scope', 'Alex', 'Done', 'High', -14, -9, '100%'],
    ['Interview five customers', 'Priya', 'Done', 'High', -10, -3, '100%'],
    ['Draft the plan', 'Sam', 'In Progress', 'High', -3, 4, '60%'],
    ['Design the first screens', 'Jordan', 'In Progress', 'Medium', -1, 8, '30%'],
    ['Book the launch venue', 'Alex', 'Blocked', 'Medium', 0, 6, '10%'],
    ['Review with the team', 'Priya', 'To Do', 'Medium', 5, 9, '0%'],
    ['Build the first version', 'Jordan', 'To Do', 'High', 9, 23, '0%'],
    ['Share the results', 'Sam', 'To Do', 'Low', 23, 26, '0%'],
  ];
  const statuses = ['To Do', 'In Progress', 'Blocked', 'Done'];
  // Body rows 5 to 12, the total on 13; the status counts' body on 17 to 20.
  return {
    heading: 'Project Tracker',
    subtitle:
      'Example tasks: type over them. Days left, progress, the counts and the chart follow as you go.',
    span: 11,
    accent: 'violet',
    widths: [220, 100, 110, 90, 100, 100, 80, 90, 28, 140, 100],
    freeze: HEAD_ROW + 1,
    blocks: [
      {
        kind: 'table',
        at: [HEAD_ROW, 0],
        head: ['Task', 'Owner', 'Status', 'Priority', 'Start', 'Due', 'Done', 'Days Left'],
        rows: tasks.map(([task, owner, status, priority, from, to, done], i): StarterCell[] => {
          const r = i + 5;
          return [
            task,
            owner,
            status,
            priority,
            day(today, from),
            day(today, to),
            done,
            `=IF(G${r}>=1,"Done",F${r}-TODAY())`,
          ];
        }),
        total: [
          'Overall',
          '=COUNTA(A5:A12)&" tasks"',
          null,
          null,
          '=MIN(E5:E12)',
          '=MAX(F5:F12)',
          '=AVERAGE(G5:G12)',
          null,
        ],
        formats: [null, null, null, null, DATE, DATE, PERCENT, { ...WHOLE, ha: 'r' }],
      },
      {
        kind: 'fields',
        at: [HEAD_ROW, 9],
        heading: 'Progress',
        items: [
          { label: 'Tasks', value: '=COUNTA(A5:A12)', f: WHOLE },
          { label: 'Done', value: '=COUNTIF(C5:C12,"Done")', f: WHOLE },
          { label: 'Blocked', value: '=COUNTIF(C5:C12,"Blocked")', f: WHOLE },
          {
            label: 'Overdue',
            value: '=COUNTIFS(F5:F12,"<"&TODAY(),C5:C12,"<>Done")',
            f: WHOLE,
          },
          { label: 'Overall', value: '=AVERAGE(G5:G12)', f: PERCENT, kind: 'result' },
        ],
      },
      {
        kind: 'table',
        at: [15, 0],
        head: ['Status', 'Tasks'],
        rows: statuses.map((s, i) => [s, `=COUNTIF($C$5:$C$12,A${17 + i})`]),
        formats: [null, WHOLE],
      },
    ],
    charts: [{ kind: 'bar-chart', table: 2, at: [15, 2], width: 420, height: 220 }],
  };
}

const DAY_MS = 86_400_000;

// The Monday of the week `now` falls in, as a date serial: `now` already on the wall clock it is read in (localMs).
export function mondayOf(now: number): number {
  const back = (new Date(now).getUTCDay() + 6) % 7;
  return Math.floor(serialFromMs(now - back * DAY_MS));
}

export function timesheetDesign(now: number): SheetDesign {
  const monday = mondayOf(now);
  const entries: [number, string, string, number, string][] = [
    [0, 'Website', 'Planning', 3.5, 'Yes'],
    [0, 'Admin', 'Email and invoices', 1, 'No'],
    [1, 'Website', 'Build', 8, 'Yes'],
    [2, 'Research', 'Interviews', 6, 'Yes'],
    [3, 'Website', 'Build', 7.5, 'Yes'],
    [4, 'Research', 'Write-up', 5, 'Yes'],
    [4, 'Admin', 'Weekly planning', 1.5, 'No'],
    [4, 'Website', 'Review', 2, 'Yes'],
  ];
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const projects = ['Website', 'Research', 'Admin'];
  return {
    heading: 'Weekly Timesheet',
    subtitle:
      'Example hours for this week: type over them. Totals, billable time and the amount to bill follow.',
    span: 9,
    accent: 'sky',
    widths: [110, 100, 130, 170, 80, 80, 28, 150, 120],
    freeze: HEAD_ROW + 1,
    blocks: [
      {
        kind: 'table',
        at: [HEAD_ROW, 0],
        head: ['Day', 'Date', 'Project', 'Task', 'Hours', 'Billable'],
        rows: entries.map(([d, project, task, hours, billable]): StarterCell[] => [
          DAYS[d]!,
          day(monday, d),
          project,
          task,
          String(hours),
          billable,
        ]),
        total: ['Total', null, null, null, '=SUM(E5:E12)', null],
        formats: [null, DATE, null, null, NUMBER1, CENTRE],
      },
      {
        kind: 'fields',
        at: [HEAD_ROW, 7],
        heading: 'This Week',
        items: [
          { label: 'Hourly Rate', value: '65', f: MONEY, kind: 'input' },
          { label: 'Hours', value: '=E13', f: NUMBER1 },
          { label: 'Billable Hours', value: '=SUMIF(F5:F12,"Yes",E5:E12)', f: NUMBER1 },
          { label: 'Billable Share', value: '=IF(I6=0,"",I7/I6)', f: PERCENT },
          { label: 'Overtime (Over 37.5)', value: '=MAX(0,I6-37.5)', f: NUMBER1 },
          { label: 'To Bill', value: '=I7*I5', f: MONEY, kind: 'result' },
        ],
      },
      {
        kind: 'table',
        at: [15, 0],
        head: ['Project', 'Hours'],
        rows: projects.map((p, i) => [p, `=SUMIF($C$5:$C$12,A${17 + i},$E$5:$E$12)`]),
        formats: [null, NUMBER1],
      },
    ],
    charts: [{ kind: 'pie-chart', table: 2, at: [15, 2], width: 400, height: 220 }],
  };
}

export function pipelineDesign(today: number): SheetDesign {
  const deals: [string, string, string, string, number, string, number][] = [
    ['Annual licence', 'Northwind', 'Alex', 'Proposal', 24000, '50%', 21],
    ['Pilot programme', 'Contoso', 'Sam', 'Qualified', 8000, '30%', 35],
    ['Support renewal', 'Fabrikam', 'Priya', 'Negotiation', 12000, '75%', 10],
    ['Team expansion', 'Tailspin', 'Jordan', 'Lead', 15000, '10%', 60],
    ['Onboarding package', 'Litware', 'Alex', 'Won', 6500, '100%', -5],
    ['Data migration', 'Adventure Works', 'Sam', 'Proposal', 18000, '50%', 28],
    ['Training days', 'Wingtip', 'Priya', 'Lost', 4000, '0%', -12],
    ['Enterprise plan', 'Woodgrove', 'Jordan', 'Negotiation', 42000, '70%', 14],
  ];
  const stages = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won'];
  const open = 'D5:D12,"<>Won",D5:D12,"<>Lost"';
  return {
    heading: 'Sales Pipeline',
    subtitle:
      'Example deals: type over them. Set each deal’s probability (yellow) and the forecast follows.',
    span: 11,
    accent: 'teal',
    widths: [170, 130, 90, 110, 110, 95, 110, 100, 28, 150, 120],
    freeze: HEAD_ROW + 1,
    blocks: [
      {
        kind: 'table',
        at: [HEAD_ROW, 0],
        head: [
          'Deal',
          'Company',
          'Owner',
          'Stage',
          'Value',
          'Probability',
          'Weighted',
          'Close Date',
        ],
        rows: deals.map(([deal, company, owner, stage, value, chance, close], i): StarterCell[] => [
          deal,
          company,
          owner,
          stage,
          String(value),
          chance,
          `=E${i + 5}*F${i + 5}`,
          day(today, close),
        ]),
        total: [
          'Total',
          '=COUNTA(A5:A12)&" deals"',
          null,
          null,
          '=SUM(E5:E12)',
          '=IF(E13=0,"",G13/E13)',
          '=SUM(G5:G12)',
          null,
        ],
        formats: [null, null, null, null, WHOLE_MONEY, PERCENT, WHOLE_MONEY, DATE],
        inputs: [5],
      },
      {
        kind: 'fields',
        at: [HEAD_ROW, 9],
        heading: 'Forecast',
        items: [
          { label: 'Open Pipeline', value: `=SUMIFS(E5:E12,${open})`, f: WHOLE_MONEY },
          {
            label: 'Weighted Forecast',
            value: `=SUMIFS(G5:G12,${open})`,
            f: WHOLE_MONEY,
            kind: 'result',
          },
          { label: 'Won', value: '=SUMIF(D5:D12,"Won",E5:E12)', f: WHOLE_MONEY },
          {
            label: 'Win Rate',
            value:
              '=IFERROR(COUNTIF(D5:D12,"Won")/(COUNTIF(D5:D12,"Won")+COUNTIF(D5:D12,"Lost")),"")',
            f: PERCENT,
          },
        ],
      },
      {
        kind: 'table',
        at: [15, 0],
        head: ['Stage', 'Value'],
        rows: stages.map((s, i) => [s, `=SUMIF($D$5:$D$12,A${17 + i},$E$5:$E$12)`]),
        formats: [null, WHOLE_MONEY],
      },
    ],
    charts: [{ kind: 'bar-chart', table: 2, at: [15, 2], width: 440, height: 240 }],
  };
}

export function inventoryDesign(): SheetDesign {
  const stock: [string, string, string, number, number, number][] = [
    ['SKU-101', 'Shipping boxes (M)', 'Packaging', 240, 100, 0.85],
    ['SKU-102', 'Bubble wrap roll', 'Packaging', 18, 20, 12.5],
    ['SKU-103', 'Packing tape', 'Packaging', 64, 30, 2.1],
    ['SKU-201', 'Printer paper (ream)', 'Office', 12, 15, 4.2],
    ['SKU-202', 'Ink cartridges', 'Office', 9, 6, 24],
    ['SKU-301', 'Label printer', 'Hardware', 3, 2, 129],
    ['SKU-302', 'Barcode scanner', 'Hardware', 1, 2, 89],
    ['SKU-303', 'USB-C cables', 'Hardware', 35, 10, 6.5],
  ];
  const cats = ['Packaging', 'Office', 'Hardware'];
  return {
    heading: 'Inventory',
    subtitle:
      'Example stock: type over it. Stock value and what to reorder work themselves out as counts change.',
    span: 11,
    accent: 'orange',
    widths: [90, 170, 110, 80, 90, 90, 110, 90, 28, 150, 120],
    freeze: HEAD_ROW + 1,
    blocks: [
      {
        kind: 'table',
        at: [HEAD_ROW, 0],
        head: [
          'SKU',
          'Item',
          'Category',
          'In Stock',
          'Reorder At',
          'Unit Cost',
          'Stock Value',
          'Status',
        ],
        rows: stock.map(([sku, item, cat, have, at, cost], i): StarterCell[] => {
          const r = i + 5;
          return [
            text(sku),
            item,
            cat,
            String(have),
            String(at),
            String(cost),
            `=D${r}*F${r}`,
            `=IF(D${r}<=E${r},"Reorder","OK")`,
          ];
        }),
        total: [
          'Total',
          '=COUNTA(B5:B12)&" items"',
          null,
          '=SUM(D5:D12)',
          null,
          null,
          '=SUM(G5:G12)',
          '=COUNTIF(H5:H12,"Reorder")&" low"',
        ],
        formats: [null, null, null, WHOLE, WHOLE, MONEY, MONEY, CENTRE],
      },
      {
        kind: 'fields',
        at: [HEAD_ROW, 9],
        heading: 'Stock',
        items: [
          { label: 'Units in Stock', value: '=D13', f: WHOLE },
          { label: 'Stock Value', value: '=G13', f: MONEY, kind: 'result' },
          { label: 'Items to Reorder', value: '=COUNTIF(H5:H12,"Reorder")', f: WHOLE },
          { label: 'Average Unit Cost', value: '=AVERAGE(F5:F12)', f: MONEY },
        ],
      },
      {
        kind: 'table',
        at: [15, 0],
        head: ['Category', 'Stock Value'],
        rows: cats.map((c, i) => [c, `=SUMIF($C$5:$C$12,A${17 + i},$G$5:$G$12)`]),
        formats: [null, MONEY],
      },
    ],
    charts: [{ kind: 'bar-chart', table: 2, at: [15, 2], width: 420, height: 220 }],
  };
}
