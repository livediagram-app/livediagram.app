// The analysis templates (docs/specs/029-sheets/sheet.md "Sheet templates"): Threat Register, Driver Model and Value
// Stream. Each the live numbers behind a drawing (the companion Sheets of the Threat model, Metric tree and Value
// stream map templates), worked from analysis-data.ts so the drawing and the sheet start out agreeing.
import { CENTRE, HEAD_ROW, NUMBER1, PERCENT, WHOLE, type SheetDesign } from './design';
import {
  DRIVER_BASELINE,
  DRIVER_LEVERS,
  DRIVER_ROWS,
  DRIVER_WHAT_IF,
  STRIDE_CATEGORIES,
  THREAT_EXAMPLES,
  THREAT_HIGH_FROM,
  THREAT_MEDIUM_FROM,
  VALUE_STREAM_HOURS_PER_DAY,
  VALUE_STREAM_STEPS,
  type DriverInputKey,
} from './analysis-data';
import type { FormatPatch } from '../format';
import type { StarterCell } from '../sheet-starters';

const PERCENT1: FormatPatch = { nf: 'percent', dp: 1 };
const CENTRED_WHOLE: FormatPatch = { ...WHOLE, ha: 'c' };

export function threatsDesign(): SheetDesign {
  const n = THREAT_EXAMPLES.length;
  // Body rows 5 to 14; the STRIDE counts' body on 18 to 23.
  const last = 4 + n;
  const body = `5:${last}`;
  const col = (c: string) => body.replace(/(\d+):(\d+)/, `${c}$1:${c}$2`);
  const countsHead = last + 3;
  return {
    heading: 'Threat Register',
    subtitle:
      'Example threats to a checkout: type over them. Set Likelihood and Impact (yellow) and the score and rating follow.',
    span: 14,
    accent: 'rose',
    widths: [56, 190, 190, 400, 96, 80, 70, 90, 380, 110, 120, 28, 170, 100],
    freeze: HEAD_ROW + 1,
    blocks: [
      {
        kind: 'table',
        at: [HEAD_ROW, 0],
        head: [
          'ID',
          'Element',
          'STRIDE',
          'Threat',
          'Likelihood',
          'Impact',
          'Score',
          'Rating',
          'Mitigation',
          'Owner',
          'Status',
        ],
        rows: THREAT_EXAMPLES.map((t, i): StarterCell[] => {
          const r = i + 5;
          return [
            t.id,
            t.element,
            t.stride,
            t.threat,
            String(t.likelihood),
            String(t.impact),
            `=E${r}*F${r}`,
            `=IF(G${r}>=${THREAT_HIGH_FROM},"High",IF(G${r}>=${THREAT_MEDIUM_FROM},"Medium","Low"))`,
            t.mitigation,
            t.owner,
            t.status,
          ];
        }),
        formats: [
          CENTRE,
          null,
          null,
          null,
          CENTRED_WHOLE,
          CENTRED_WHOLE,
          CENTRED_WHOLE,
          CENTRE,
          null,
          null,
          null,
        ],
        inputs: [4, 5],
      },
      {
        kind: 'note',
        at: [last, 0],
        text: `Score is Likelihood × Impact: ${THREAT_HIGH_FROM} and over is High, ${THREAT_MEDIUM_FROM} to ${THREAT_HIGH_FROM - 1} Medium, under ${THREAT_MEDIUM_FROM} Low.`,
      },
      {
        kind: 'fields',
        at: [HEAD_ROW, 12],
        heading: 'Summary',
        items: [
          { label: 'Threats', value: `=COUNTA(${col('A')})`, f: WHOLE },
          { label: 'High', value: `=COUNTIF(${col('H')},"High")`, f: WHOLE },
          { label: 'Not Yet Mitigated', value: `=COUNTIF(${col('K')},"<>Mitigated")`, f: WHOLE },
          { label: 'Highest Score', value: `=MAX(${col('G')})`, f: WHOLE },
          {
            label: 'Mitigated',
            value: `=IF(N5=0,"",COUNTIF(${col('K')},"Mitigated")/N5)`,
            f: PERCENT,
            kind: 'result',
          },
        ],
      },
      {
        kind: 'table',
        at: [countsHead - 1, 1],
        head: ['STRIDE', 'Threats'],
        rows: STRIDE_CATEGORIES.map((s, i) => [
          s,
          `=COUNTIF($C$5:$C$${last},B${countsHead + 1 + i})`,
        ]),
        formats: [null, WHOLE],
      },
    ],
    charts: [{ kind: 'bar-chart', table: 3, at: [countsHead - 1, 3], width: 460, height: 230 }],
  };
}

// A rate typed as a percentage ("95.3%"), a count with its thousands ("205,000"), else the number as it is ("1.72"):
// the sheet reads the format each hints, so one column holds all three.
function typed(key: DriverInputKey, v: number): string {
  if (key === 'conversion' || key === 'retention' || key.endsWith('OnTime'))
    return `${Number((v * 100).toFixed(1))}%`;
  if (Number.isInteger(v) && v >= 1000) return v.toLocaleString('en-GB');
  return String(v);
}

// The format a driver input reads in: a rate as a percentage to one place, a count whole with its thousands, else to
// two places (orders per customer).
function inputFormat(key: DriverInputKey): FormatPatch {
  if (key === 'conversion' || key === 'retention' || key.endsWith('OnTime')) return PERCENT1;
  if (key === 'visitors' || key === 'lastActives') return WHOLE;
  return { nf: 'number', dp: 2 };
}

// The tree in cells: new + returning customers, the actives they make, their orders, the on-time rate, the north
// star; `c` the column holding the inputs (rows 5 to 11, in DRIVER_ROWS' order).
const ROW: Record<DriverInputKey, number> = Object.fromEntries(
  DRIVER_ROWS.map((d, i) => [d.key, i + 5]),
) as Record<DriverInputKey, number>;
function treeCells(c: string, out: string) {
  const at = (k: DriverInputKey) => `${c}${ROW[k]}`;
  return {
    newCustomers: `=${at('visitors')}*${at('conversion')}`,
    returning: `=${at('lastActives')}*${at('retention')}`,
    actives: `=${out}5+${out}6`,
    orders: `=${out}7*${at('ordersPerCustomer')}`,
    onTime: `=${at('kitchenOnTime')}*${at('courierOnTime')}`,
    northStar: `=${out}8*${out}9`,
  };
}

// The north star with one input taken from `cell` instead of the baseline, less the baseline's.
function leverFormula(key: DriverInputKey, cell: string): string {
  const v = (k: DriverInputKey) => (k === key ? cell : `C${ROW[k]}`);
  // Whole orders: what the chart reads (and its tooltip shows) is a count, not a float.
  return (
    `=ROUND((${v('visitors')}*${v('conversion')}+${v('lastActives')}*${v('retention')})` +
    `*${v('ordersPerCustomer')}*${v('kitchenOnTime')}*${v('courierOnTime')}-$H$10,0)`
  );
}

export function driversDesign(): SheetDesign {
  const base = treeCells('C', 'H');
  const what = treeCells('D', 'K');
  const leversHead = 13;
  return {
    heading: 'Driver Model',
    subtitle:
      'A north star worked from the inputs teams own. Type a What If (yellow) and see what it does to on-time orders.',
    span: 11,
    accent: 'indigo',
    widths: [240, 130, 190, 110, 90, 28, 170, 110, 28, 170, 110],
    freeze: HEAD_ROW + 1,
    blocks: [
      {
        kind: 'table',
        at: [HEAD_ROW, 0],
        head: ['Input', 'Owner', 'Baseline', 'What If', 'Change'],
        rows: DRIVER_ROWS.map(({ key, name, owner }, i): StarterCell[] => {
          const r = i + 5;
          return [
            name,
            owner,
            typed(key, DRIVER_BASELINE[key]),
            typed(key, DRIVER_WHAT_IF[key]),
            `=IF(C${r}=0,"",D${r}/C${r}-1)`,
          ];
        }),
        formats: [null, null, null, null, PERCENT1],
        cellFormats: DRIVER_ROWS.flatMap(({ key }, row) =>
          [2, 3].map((col) => ({ row, col, f: inputFormat(key) })),
        ),
        inputs: [3],
      },
      {
        kind: 'fields',
        at: [HEAD_ROW, 6],
        heading: 'Baseline',
        items: [
          { label: 'New Customers', value: base.newCustomers, f: WHOLE },
          { label: 'Returning Customers', value: base.returning, f: WHOLE },
          { label: 'Active Customers', value: base.actives, f: WHOLE },
          { label: 'Orders', value: base.orders, f: WHOLE },
          { label: 'On-Time Rate', value: base.onTime, f: PERCENT1 },
          { label: 'On-Time Orders', value: base.northStar, f: WHOLE, kind: 'result' },
        ],
      },
      {
        kind: 'fields',
        at: [HEAD_ROW, 9],
        heading: 'What If',
        items: [
          { label: 'New Customers', value: what.newCustomers, f: WHOLE },
          { label: 'Returning Customers', value: what.returning, f: WHOLE },
          { label: 'Active Customers', value: what.actives, f: WHOLE },
          { label: 'Orders', value: what.orders, f: WHOLE },
          { label: 'On-Time Rate', value: what.onTime, f: PERCENT1 },
          { label: 'On-Time Orders', value: what.northStar, f: WHOLE, kind: 'result' },
          { label: 'Uplift', value: '=K10-H10', f: WHOLE },
          { label: 'Uplift %', value: '=IF(H10=0,"",K11/H10)', f: PERCENT1 },
        ],
      },
      {
        kind: 'note',
        at: [12, 0],
        text: 'Which lever buys the most? Each row moves one input to what a quarter could achieve (yellow).',
      },
      {
        kind: 'table',
        at: [leversHead, 0],
        head: ['Lever', 'Achievable', 'On-Time Orders Gained'],
        rows: DRIVER_LEVERS.map(({ key, name, achievable }, i): StarterCell[] => [
          name,
          typed(key, achievable),
          leverFormula(key, `B${leversHead + 2 + i}`),
        ]),
        formats: [null, null, WHOLE],
        cellFormats: DRIVER_LEVERS.map(({ key }, row) => ({ row, col: 1, f: inputFormat(key) })),
        inputs: [1],
      },
    ],
    charts: [
      {
        kind: 'bar-chart',
        table: 4,
        cols: [0, 2],
        at: [leversHead, 3],
        width: 460,
        height: 230,
      },
    ],
  };
}

export function valueStreamDesign(): SheetDesign {
  const n = VALUE_STREAM_STEPS.length;
  const last = 4 + n;
  const total = last + 1;
  const splitHead = total + 2;
  return {
    heading: 'Value Stream',
    subtitle:
      'Example steps from idea to production: type over them. Lead time, flow efficiency and the longest wait follow.',
    span: 9,
    accent: 'teal',
    widths: [150, 130, 130, 130, 90, 80, 28, 180, 120],
    freeze: HEAD_ROW + 1,
    blocks: [
      {
        kind: 'table',
        at: [HEAD_ROW, 0],
        head: ['Step', 'Owner', 'Process Time (h)', 'Wait Before (d)', '%C&A', 'People'],
        rows: VALUE_STREAM_STEPS.map((s): StarterCell[] => [
          s.step,
          s.owner,
          String(s.processHours),
          String(s.waitDays),
          `${Math.round(s.completeAccurate * 100)}%`,
          String(s.people),
        ]),
        total: [
          'Total',
          null,
          `=SUM(C5:C${last})`,
          `=SUM(D5:D${last})`,
          `=PRODUCT(E5:E${last})`,
          `=SUM(F5:F${last})`,
        ],
        formats: [null, null, NUMBER1, NUMBER1, PERCENT, CENTRED_WHOLE],
      },
      {
        kind: 'fields',
        at: [HEAD_ROW, 7],
        heading: 'Flow',
        items: [
          {
            label: 'Hours per Day',
            value: String(VALUE_STREAM_HOURS_PER_DAY),
            f: NUMBER1,
            kind: 'input',
          },
          { label: 'Lead Time (d)', value: `=D${total}+C${total}/I5`, f: NUMBER1 },
          { label: 'Process Time (d)', value: `=C${total}/I5`, f: NUMBER1 },
          { label: 'Flow Efficiency', value: '=IF(I6=0,"",I7/I6)', f: PERCENT1, kind: 'result' },
          { label: 'Rolled %C&A', value: `=E${total}`, f: PERCENT },
          {
            label: 'Longest Wait',
            value: `=INDEX(A5:A${last},MATCH(MAX(D5:D${last}),D5:D${last},0))`,
          },
        ],
      },
      {
        kind: 'table',
        at: [splitHead - 1, 0],
        head: ['Step', 'Waiting (d)', 'Working (d)'],
        rows: VALUE_STREAM_STEPS.map((_, i) => {
          const r = i + 5;
          return [`=A${r}`, `=D${r}`, `=C${r}/$I$5`];
        }),
        formats: [null, NUMBER1, NUMBER1],
      },
    ],
    // A bar chart reads one series: the waiting, which is where the time goes.
    charts: [
      {
        kind: 'bar-chart',
        table: 2,
        cols: [0, 1],
        at: [splitHead - 1, 3],
        width: 460,
        height: 230,
      },
    ],
  };
}
