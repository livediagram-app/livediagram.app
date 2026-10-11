// The money templates (docs/specs/029-sheets/sheet.md "Sheet templates"): Budget, Invoice, Expense Report and Loan
// Calculator. Each is example data worked by live formulas: type over the figures and everything else follows.
import {
  DATE,
  HEAD_ROW,
  MONEY,
  PERCENT,
  WHOLE,
  WHOLE_MONEY,
  CENTRE,
  day,
  text,
  type SheetDesign,
} from './design';
import type { StarterCell } from '../sheet-starters';

export function budgetDesign(): SheetDesign {
  const items: [string, string, number, number][] = [
    ['Home', 'Rent', 1200, 1200],
    ['Home', 'Utilities', 180, 164],
    ['Food', 'Groceries', 350, 382],
    ['Food', 'Eating Out', 120, 96],
    ['Travel', 'Transport', 140, 120],
    ['Leisure', 'Subscriptions', 45, 52],
    ['Leisure', 'Gym', 40, 40],
    ['Savings', 'Emergency Fund', 300, 300],
  ];
  // Body rows 5 to 12, the total on 13.
  const cats = ['Home', 'Food', 'Travel', 'Leisure', 'Savings'];
  return {
    heading: 'Monthly Budget',
    subtitle:
      'Example figures: type over them. Differences, totals, the summary and the chart follow as you go.',
    span: 9,
    accent: 'emerald',
    widths: [120, 170, 110, 110, 110, 90, 28, 160, 120],
    freeze: HEAD_ROW + 1,
    blocks: [
      {
        kind: 'table',
        at: [HEAD_ROW, 0],
        head: ['Category', 'Item', 'Planned', 'Actual', 'Difference', '% Used'],
        rows: items.map(([cat, item, plan, actual], i) => {
          const r = i + 5;
          return [
            cat,
            item,
            String(plan),
            String(actual),
            `=C${r}-D${r}`,
            `=IF(C${r}=0,"",D${r}/C${r})`,
          ];
        }),
        total: [
          'Total',
          null,
          '=SUM(C5:C12)',
          '=SUM(D5:D12)',
          '=SUM(E5:E12)',
          '=IF(C13=0,"",D13/C13)',
        ],
        formats: [null, null, MONEY, MONEY, MONEY, PERCENT],
      },
      {
        kind: 'fields',
        at: [HEAD_ROW, 7],
        heading: 'Summary',
        items: [
          { label: 'Monthly Income', value: '3200', f: MONEY, kind: 'input' },
          { label: 'Planned Spend', value: '=C13', f: MONEY },
          { label: 'Actual Spend', value: '=D13', f: MONEY },
          { label: 'Left Over', value: '=I5-I7', f: MONEY, kind: 'result' },
          { label: 'Share of Income Spent', value: '=IF(I5=0,"",I7/I5)', f: PERCENT },
        ],
      },
      {
        kind: 'table',
        at: [15, 0],
        head: ['Category', 'Spent'],
        rows: cats.map((c, i) => [c, `=SUMIF($A$5:$A$12,A${17 + i},$D$5:$D$12)`]),
        formats: [null, MONEY],
      },
    ],
    charts: [{ kind: 'pie-chart', table: 2, at: [15, 3], width: 420, height: 240 }],
  };
}

export function invoiceDesign(today: number): SheetDesign {
  const lines: [string, number, number][] = [
    ['Brand workshop', 1, 1200],
    ['Logo design', 1, 2400],
    ['Website pages', 6, 450],
    ['Copywriting (hours)', 12, 65],
    ['Hosting setup', 1, 150],
  ];
  // Line items on 13 to 17; the subtotal, tax rate, tax and total due on 19 to 22.
  return {
    heading: 'Invoice',
    subtitle:
      'Example details: replace them with yours. Line amounts, tax and the amount due work themselves out.',
    span: 7,
    accent: 'blue',
    widths: [220, 90, 120, 130, 28, 120, 150],
    freeze: 0,
    blocks: [
      {
        kind: 'fields',
        at: [HEAD_ROW, 0],
        heading: 'From',
        items: [
          { label: 'Business', value: 'Your Studio Ltd' },
          { label: 'Email', value: text('hello@yourstudio.example') },
        ],
      },
      {
        kind: 'fields',
        at: [7, 0],
        heading: 'Bill To',
        items: [
          { label: 'Client', value: 'Northwind Ltd' },
          { label: 'Contact', value: 'Jordan Lee' },
        ],
      },
      {
        kind: 'fields',
        at: [HEAD_ROW, 5],
        heading: 'Details',
        items: [
          { label: 'Invoice No.', value: text('INV-0042'), kind: 'input' },
          { label: 'Issued', value: day(today), f: DATE, kind: 'input' },
          { label: 'Due', value: '=G6+30', f: DATE },
          { label: 'Amount Due', value: '=D22', f: MONEY, kind: 'result' },
        ],
      },
      {
        kind: 'table',
        at: [11, 0],
        head: ['Description', 'Qty', 'Rate', 'Amount'],
        rows: lines.map(([what, qty, rate], i) => [
          what,
          String(qty),
          String(rate),
          `=B${13 + i}*C${13 + i}`,
        ]),
        formats: [null, WHOLE, MONEY, MONEY],
      },
      {
        kind: 'fields',
        at: [18, 2],
        items: [
          { label: 'Subtotal', value: '=SUM(D13:D17)', f: MONEY },
          { label: 'Tax Rate', value: '20%', f: PERCENT, kind: 'input' },
          { label: 'Tax', value: '=D19*D20', f: MONEY },
          { label: 'Total Due', value: '=D19+D21', f: MONEY, kind: 'result' },
        ],
      },
      {
        kind: 'note',
        at: [23, 0],
        text: 'Thank you for your business. Payment is due within 30 days.',
      },
    ],
  };
}

export function expensesDesign(today: number): SheetDesign {
  const spend: [number, string, string, string, number, string][] = [
    [-9, 'Rail Co', 'Travel', 'Train to Leeds', 86.4, 'Yes'],
    [-9, 'Hotel Central', 'Lodging', 'One night', 129, 'Yes'],
    [-9, 'Bistro 21', 'Meals', 'Lunch with the client', 42.5, 'Yes'],
    [-9, 'City Cabs', 'Travel', 'Taxi to the office', 18.2, 'No'],
    [-9, 'The Grill', 'Meals', 'Dinner', 36, 'Yes'],
    [-8, 'PrintHub', 'Supplies', 'Printed handouts', 24.99, 'Yes'],
    [-8, 'Rail Co', 'Travel', 'Train home', 86.4, 'Yes'],
    [-8, 'Station Café', 'Meals', 'Coffee', 6.8, 'No'],
  ];
  const cats = ['Travel', 'Lodging', 'Meals', 'Supplies'];
  return {
    heading: 'Expense Report',
    subtitle:
      'Example claims: replace them with yours. The totals, the summary and the chart follow.',
    span: 9,
    accent: 'amber',
    widths: [100, 140, 110, 190, 100, 80, 28, 150, 150],
    freeze: HEAD_ROW + 1,
    blocks: [
      {
        kind: 'table',
        at: [HEAD_ROW, 0],
        head: ['Date', 'Merchant', 'Category', 'Description', 'Amount', 'Receipt'],
        rows: spend.map(([d, who, cat, what, amount, receipt]) => [
          day(today, d),
          who,
          cat,
          what,
          String(amount),
          receipt,
        ]),
        total: [
          'Total',
          null,
          null,
          null,
          '=SUM(E5:E12)',
          '=COUNTIF(F5:F12,"Yes")&" of "&COUNTA(F5:F12)',
        ],
        formats: [DATE, null, null, null, MONEY, CENTRE],
      },
      {
        kind: 'fields',
        at: [HEAD_ROW, 7],
        heading: 'Claim',
        items: [
          { label: 'Employee', value: 'Alex Morgan', kind: 'input' },
          { label: 'Purpose', value: 'Client visit, Leeds', kind: 'input' },
          { label: 'Claimed', value: '=E13', f: MONEY },
          { label: 'Missing Receipts', value: '=COUNTIF(F5:F12,"No")', f: WHOLE },
          { label: 'Reimbursable', value: '=SUMIF(F5:F12,"Yes",E5:E12)', f: MONEY, kind: 'result' },
        ],
      },
      {
        kind: 'table',
        at: [15, 0],
        head: ['Category', 'Amount'],
        rows: cats.map((c, i) => [c, `=SUMIF($C$5:$C$12,A${17 + i},$E$5:$E$12)`]),
        formats: [null, MONEY],
      },
    ],
    charts: [{ kind: 'pie-chart', table: 2, at: [15, 3], width: 400, height: 220 }],
  };
}

// How many years the Loan Calculator's schedule lists, and its term to start (a shorter term leaves the rows past it
// empty; the chart reads them as nothing).
export const LOAN_YEARS = 30;

export function loanDesign(): SheetDesign {
  // The schedule's body on rows 11 to 40.
  const guard = (r: number, formula: string): StarterCell => `=IF($A${r}>$B$7,"",${formula})`;
  const years = Array.from({ length: LOAN_YEARS }, (_, i): StarterCell[] => {
    const r = 11 + i;
    return [
      String(i + 1),
      guard(r, i === 0 ? '$B$5' : `F${r - 1}`),
      guard(r, '$D$5*12'),
      guard(r, `C${r}-E${r}`),
      guard(r, `B${r}-F${r}`),
      guard(r, `MAX(0,FV($B$6/12,A${r}*12,$D$5,-$B$5))`),
    ];
  });
  return {
    heading: 'Loan Calculator',
    subtitle:
      'Change the amount, rate or term in the yellow cells: the payment and the year-by-year schedule follow.',
    span: 6,
    accent: 'cyan',
    widths: [150, 120, 150, 120, 120, 130],
    freeze: 0,
    blocks: [
      {
        kind: 'fields',
        at: [HEAD_ROW, 0],
        heading: 'Loan',
        items: [
          { label: 'Amount', value: '250000', f: WHOLE_MONEY, kind: 'input' },
          { label: 'Annual Rate', value: '4.5%', f: { nf: 'percent', dp: 2 }, kind: 'input' },
          { label: 'Term in Years', value: String(LOAN_YEARS), f: WHOLE, kind: 'input' },
        ],
      },
      {
        kind: 'fields',
        at: [HEAD_ROW, 2],
        heading: 'Repayments',
        items: [
          { label: 'Monthly Payment', value: '=PMT(B6/12,B7*12,-B5)', f: MONEY, kind: 'result' },
          { label: 'Total Paid', value: '=D5*B7*12', f: MONEY },
          { label: 'Total Interest', value: '=D6-B5', f: MONEY },
          { label: 'Interest Share', value: '=IF(D6=0,"",D7/D6)', f: PERCENT },
        ],
      },
      {
        kind: 'table',
        at: [9, 0],
        head: ['Year', 'Opening Balance', 'Paid', 'Interest', 'Principal', 'Closing Balance'],
        rows: years,
        formats: [CENTRE, WHOLE_MONEY, WHOLE_MONEY, WHOLE_MONEY, WHOLE_MONEY, WHOLE_MONEY],
      },
    ],
    charts: [
      { kind: 'line-chart', table: 2, cols: [0, 3, 4], at: [HEAD_ROW, 6], width: 440, height: 260 },
    ],
  };
}
