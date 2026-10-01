// Table-based template builders: the plan-comparison grid and the RACI
// responsibility matrix. Both are a single `table` element doing the real
// work (header row + column, per-cell tints via `cellStyles`), so users see
// tables earning their keep straight away, framed by a title, a one-line
// how-to and the few shapes that make the grid a decision.
//
// Pure: (cx, cy) -> Element[]. See docs/specs/008-canvas/canvas-and-palette.md
// "Templates".

import {
  createShape,
  createSticky,
  createTable,
  createText,
  type Element,
  type TableCellStyle,
} from '@livediagram/document';

const MUTED = '#64748b';

// Cells that carry their own background also carry their own ink, so a tint
// reads the same on a dark canvas (the theme owns only the untinted cells).
const tint = (bg: string, textColor: string, bold = false): TableCellStyle => ({
  bg,
  textColor,
  ...(bold ? { bold: true } : {}),
});
// The header row and column get the same treatment: the default header band
// is a pale tint of the grid stroke, which a dark canvas's light ink cannot
// be read on, so the headers pin their own paper and ink.
const HEAD_ROW = tint('#e2e8f0', '#0f172a', true);
const HEAD_COL = tint('#f1f5f9', '#0f172a', true);

// A buying decision rather than a spec sheet: three plans of a made-up team
// chat app compared for a 14-person team. Yes / no rows read as ✓ / ✗ (a
// green tick, a muted cross) so the gaps jump out; the recommended plan's
// column is tinted amber and bold with an "Our pick" ribbon over it; a
// "Cost for 14 seats" row does the sum the reader would otherwise do in
// their head; and a sticky beside the table gives the one-line reason, which
// is what a comparison is for.
const PLAN_CELLS = [
  ['Feature', 'Free', 'Team', 'Business'],
  ['Price per seat', '£0', '£6 a month', '£12 a month'],
  ['Seats', 'Up to 5', 'Unlimited', 'Unlimited'],
  ['Message history', '90 days', 'Unlimited', 'Unlimited'],
  ['Video calls', '1:1 only', 'Up to 50 people', 'Up to 200 people'],
  ['Guest access', '✗', '✓', '✓'],
  ['Shared channels', '✗', '✓', '✓'],
  ['Single sign-on (SSO)', '✗', '✗', '✓'],
  ['Support', 'Community', 'Email, 24 h', 'Phone, 1 h'],
  ['Cost for 14 seats', 'Too small', '£84 a month', '£168 a month'],
  ['Best for', 'Trying it out', 'Growing teams', 'Regulated companies'],
];
// The recommended plan's column index.
const PICK_COL = 2;
const PICK = { head: '#fde68a', body: '#fef3c7', ink: '#451a03' };
const YES = '#16a34a';
const NO = '#94a3b8';

export function buildComparisonTable(cx: number, cy: number): Element[] {
  const tableW = 900;
  const rowH = 46;
  const tableH = PLAN_CELLS.length * rowH;
  const featureW = 240;
  const planW = (tableW - featureW) / (PLAN_CELLS[0]!.length - 1);
  const noteGap = 36;
  const noteW = 280;
  const titleH = 48;
  const captionH = 28;
  const ribbonH = 32;
  const headGap = 24 + ribbonH + 8;
  const totalW = tableW + noteGap + noteW;
  const totalH = titleH + captionH + headGap + tableH;
  const x0 = cx - totalW / 2;
  const y0 = cy - totalH / 2;
  const tableTop = y0 + titleH + captionH + headGap;

  const cellStyles = PLAN_CELLS.map((row, r) =>
    row.map((cell, c): TableCellStyle | null => {
      const pick = c === PICK_COL;
      if (r === 0) return pick ? tint(PICK.head, PICK.ink, true) : HEAD_ROW;
      if (c === 0) return HEAD_COL;
      const mark = cell === '✓' ? YES : cell === '✗' ? NO : undefined;
      // Ticks and crosses draw a size up so the gaps read at a glance.
      const markSize = mark ? { textSize: 'lg' as const } : {};
      if (pick) return { ...tint(PICK.body, mark ?? PICK.ink, true), ...markSize };
      return mark ? { textColor: mark, bold: true, ...markSize } : null;
    }),
  );

  const pickX = x0 + featureW + (PICK_COL - 1) * planW;
  const ribbonW = 150;
  return [
    {
      ...createText(x0, y0),
      width: totalW,
      height: titleH,
      label: 'Which Tandem plan should we buy?',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(x0, y0 + titleH),
      width: totalW,
      height: captionH,
      label:
        'Read down a column: ✓ is included, ✗ is not. The highlighted plan is the recommendation for our 14-person team.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
    {
      ...createShape('stadium', pickX + (planW - ribbonW) / 2, tableTop - ribbonH - 8),
      width: ribbonW,
      height: ribbonH,
      label: '★ Our pick',
      textSize: 'sm',
      textBold: true,
      fillColor: '#f59e0b',
      strokeColor: '#d97706',
      textColor: '#451a03',
      themeLockFill: true,
    },
    {
      ...createTable(x0, tableTop),
      width: tableW,
      height: tableH,
      cells: PLAN_CELLS.map((row) => [...row]),
      cellStyles,
      headerRow: true,
      headerColumn: true,
      colWidths: [featureW, null, null, null],
    },
    {
      ...createSticky(x0 + tableW + noteGap, tableTop),
      width: noteW,
      height: 132,
      label:
        'Why Team: guest access and shared channels are what we need for the agency. SSO is the only Business extra, and it can wait for the Q2 audit.',
      textSize: 'sm',
      fillColor: '#fde68a',
      textColor: '#451a03',
    },
  ];
}

// RACI: who does what on a mobile app launch. Tasks run down the side and
// named roles across the top; every letter cell is tinted by its role
// (R green, A blue, C amber, I slate, the same key the roadmap chips use) so
// the pattern of a row reads before its letters do, and exactly one A per
// row, the rule people most often break. A legend beneath spells each letter
// out with what it means in practice, and a "Row checks" checklist beside
// the grid carries the three sanity checks a RACI is reviewed against,
// followed by a tip sticky about the most common failure (consulting
// everyone).
type RaciLetter = 'R' | 'A' | 'C' | 'I';
const RACI_KEY: Record<RaciLetter, { name: string; meaning: string; bg: string; ink: string }> = {
  R: { name: 'Responsible', meaning: 'Does the work', bg: '#dcfce7', ink: '#15803d' },
  A: { name: 'Accountable', meaning: 'Signs it off, one per task', bg: '#dbeafe', ink: '#1d4ed8' },
  C: { name: 'Consulted', meaning: 'Asked before, two-way', bg: '#fef3c7', ink: '#a16207' },
  I: { name: 'Informed', meaning: 'Told after, one-way', bg: '#f1f5f9', ink: '#475569' },
};

const RACI_CELLS = [
  ['Task', 'Product · Priya', 'Design · Tom', 'Engineering · Sam', 'QA · Ana', 'Marketing · Leo'],
  ['Write the launch brief', 'A/R', 'C', 'C', 'I', 'C'],
  ['Design the onboarding', 'A', 'R', 'C', 'I', 'I'],
  ['Build the release', 'I', 'C', 'A/R', 'C', 'I'],
  ['Test on 20 devices', 'I', 'I', 'C', 'A/R', 'I'],
  ['Submit to the App Store', 'A', 'I', 'R', 'C', 'I'],
  ['Run the launch campaign', 'C', 'C', 'I', 'I', 'A/R'],
  ['Answer day-one support', 'A', 'I', 'R', 'R', 'I'],
];

const RACI_CHECKS = [
  'Every row has exactly one A',
  'Every row has at least one R',
  'Nobody is R on everything',
];

export function buildRaciMatrix(cx: number, cy: number): Element[] {
  const taskW = 260;
  const roleW = 156;
  const tableW = taskW + (RACI_CELLS[0]!.length - 1) * roleW;
  const rowH = 50;
  const tableH = RACI_CELLS.length * rowH;
  const sideGap = 36;
  const sideW = 300;
  const titleH = 48;
  const captionH = 28;
  const headGap = 28;
  const legendGap = 28;
  const legendH = 76;
  const totalW = tableW + sideGap + sideW;
  const totalH = titleH + captionH + headGap + tableH + legendGap + legendH;
  const x0 = cx - totalW / 2;
  const y0 = cy - totalH / 2;
  const tableTop = y0 + titleH + captionH + headGap;

  // An A/R cell is tinted as its A: accountability is the letter to find.
  const cellStyles = RACI_CELLS.map((row, r) =>
    row.map((cell, c): TableCellStyle | null => {
      if (r === 0) return HEAD_ROW;
      if (c === 0) return HEAD_COL;
      const k = RACI_KEY[cell.charAt(0) as RaciLetter];
      return k ? { ...tint(k.bg, k.ink, true), textSize: 'lg' } : null;
    }),
  );

  const elements: Element[] = [
    {
      ...createText(x0, y0),
      width: totalW,
      height: titleH,
      label: 'Mobile app launch · RACI',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(x0, y0 + titleH),
      width: totalW,
      height: captionH,
      label:
        'One A per row: the person who signs it off. R does the work, C is asked before, I is told after.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
    {
      ...createTable(x0, tableTop),
      width: tableW,
      height: tableH,
      cells: RACI_CELLS.map((row) => [...row]),
      cellStyles,
      headerRow: true,
      headerColumn: true,
      // The task column needs the room; the role columns share the rest.
      colWidths: [taskW, null, null, null, null, null],
    },
  ];

  // Legend cards: each letter's tint, its name, and what it means in practice.
  const letters = Object.keys(RACI_KEY) as RaciLetter[];
  const cardGap = 16;
  const cardW = (tableW - cardGap * (letters.length - 1)) / letters.length;
  const legendY = tableTop + tableH + legendGap;
  letters.forEach((letter, i) => {
    const k = RACI_KEY[letter];
    const x = x0 + i * (cardW + cardGap);
    elements.push(
      {
        ...createShape('square', x, legendY),
        width: cardW,
        height: legendH,
        fillColor: k.bg,
        strokeColor: k.ink,
        themeLockFill: true,
      },
      {
        ...createText(x + 16, legendY + 10),
        width: cardW - 32,
        height: 30,
        label: `${letter} · ${k.name}`,
        textSize: 'sm',
        textBold: true,
        textAlignX: 'left',
        textColor: k.ink,
      },
      {
        ...createText(x + 16, legendY + 40),
        width: cardW - 32,
        height: 24,
        label: k.meaning,
        textSize: 'sm',
        textAlignX: 'left',
        textColor: '#334155',
      },
    );
  });

  // The review rail: the checks a RACI is read against, then the tip.
  const sideX = x0 + tableW + sideGap;
  const checklistH = RACI_CHECKS.length * 30 + 22;
  elements.push(
    {
      ...createText(sideX, tableTop),
      width: sideW,
      height: 32,
      label: 'Row checks',
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createShape('checklist', sideX, tableTop + 40),
      width: sideW,
      height: checklistH,
      checklistItems: RACI_CHECKS.map((text) => ({ text, done: false })),
    },
    {
      ...createSticky(sideX, tableTop + 40 + checklistH + 24),
      width: sideW,
      height: 120,
      label:
        'Tip: too many Cs slow a task down. If everyone is consulted, nobody decides, so keep C for the people who can change the answer.',
      textSize: 'sm',
      fillColor: '#fde68a',
      textColor: '#451a03',
    },
  );

  return elements;
}
