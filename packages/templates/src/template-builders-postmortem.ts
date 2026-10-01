// The incident postmortem template (docs/specs/008-canvas/canvas-and-palette.md
// "Templates"): a blameless, SRE-style write-up of one worked incident,
// Plateful's checkout outage (template-postmortem-data.ts holds the story).
//
// It reads top to bottom in the order a postmortem is written. A summary
// band states what happened beside a Blameless reminder and a stat row of
// the impact. The timeline runs left to right through the five phases
// (trigger, detection, response, mitigation, resolution), each a column of
// timestamped cards in its phase's hue, red through to green, with the
// time-to-detect / mitigate / resolve spans bracketed underneath from the
// moment impact began. Below, the five whys walk from the symptom down to a
// systemic root cause, beside what we learned (contributing factors, what
// went well, where we got lucky) and the prioritised action items that
// close the report.
//
// Layers: the "Report" scaffold is the frame a team reuses (section
// headings, phase headers, the summary and findings containers, the
// Blameless reminder); "Findings" holds everything this incident filled in.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createShape,
  createSticky,
  createTable,
  createText,
  type Element,
  type TableCellStyle,
} from '@livediagram/document';
import { techHeader, TECH_HEADER_H } from './template-builders-technical-kit';
import {
  PM_ACTIONS,
  PM_BLAMELESS,
  PM_CAPTION,
  PM_CHIPS,
  PM_FINDINGS,
  PM_META,
  PM_PRIORITY,
  PM_STATS,
  PM_SUMMARY,
  PM_TITLE,
} from './template-postmortem-data';
import {
  CONTENT,
  HEADING_GAP,
  INK,
  MUTED,
  PAPER,
  RULE,
  SCAFFOLD,
  SECTION_H,
  chipRow,
  sectionHeading,
} from './template-report-kit';
import { postmortemTimeline } from './template-postmortem-timeline';
import { postmortemFiveWhys } from './template-postmortem-whys';

const WIDTH = 2080;
const SECTION_GAP = 52;

export function buildIncidentPostmortem(cx: number, cy: number): Element[] {
  const summaryH = 176;
  const phaseHeadH = 56;
  const cardH = 96;
  const cardGap = 14;
  const spanPitch = 44;
  const timelineH =
    SECTION_H + HEADING_GAP + phaseHeadH + 2 * cardH + cardGap + 36 + 2 * spanPitch + 12;
  const findingsH = findingsHeight();
  const actionsH = SECTION_H + HEADING_GAP + PM_ACTIONS.length * ACTION_ROW_H;
  const lowerH = SECTION_H + HEADING_GAP + findingsH + 36 + actionsH;
  const totalH = TECH_HEADER_H + 28 + summaryH + SECTION_GAP + timelineH + SECTION_GAP + lowerH;

  const x0 = cx - WIDTH / 2;
  const y0 = cy - totalH / 2;
  const summaryTop = y0 + TECH_HEADER_H + 28;
  const timelineTop = summaryTop + summaryH + SECTION_GAP;
  const lowerTop = timelineTop + timelineH + SECTION_GAP;

  const elements: Element[] = [
    ...techHeader(x0, y0, 1300, PM_TITLE, PM_CAPTION, {
      title: CONTENT.layerId,
      caption: SCAFFOLD.layerId,
    }),
    ...headerChips(x0 + WIDTH, y0 + 10),
    ...summaryBand(x0, summaryTop, summaryH),
    ...postmortemTimeline(x0, WIDTH, timelineTop, phaseHeadH, cardH, cardGap, spanPitch),
  ];

  // The lower half: the five whys on the left, what we learned and the
  // action items stacked on the right, bottoms aligned.
  const leftW = 620;
  const rightX = x0 + leftW + 48;
  const rightW = WIDTH - leftW - 48;
  const bodyTop = lowerTop + SECTION_H + HEADING_GAP;
  elements.push(
    ...postmortemFiveWhys(x0, lowerTop, leftW, lowerH),
    ...sectionHeading(
      rightX,
      lowerTop,
      rightW,
      'layers',
      'What we learned',
      'Add a note to any column before the review',
    ),
    ...findings(rightX, bodyTop, rightW, findingsH),
    ...actionItems(rightX, bodyTop + findingsH + 36, rightW),
  );
  return elements;
}

// Severity, status and review date, right-aligned on the title's line.
function headerChips(right: number, y: number): Element[] {
  return chipRow(right, y, [
    { w: 84, label: PM_CHIPS.severity, fill: '#ea580c', stroke: '#c2410c', ink: '#ffffff' },
    { w: 156, label: PM_CHIPS.status, fill: '#dcfce7', stroke: '#86efac', ink: '#14532d' },
    { w: 188, label: PM_CHIPS.review, fill: '#f1f5f9', stroke: '#cbd5e1', ink: '#334155' },
  ]);
}

// What happened in a paragraph, the blameless reminder, and the impact.
function summaryBand(x0: number, top: number, h: number): Element[] {
  const summaryW = 800;
  const calloutW = 420;
  const gap = 24;
  const pad = 24;
  const statsX = x0 + summaryW + gap + calloutW + gap;
  return [
    {
      ...createShape('square', x0, top),
      width: summaryW,
      height: h,
      fillColor: PAPER,
      strokeColor: RULE,
      borderRadius: 'md',
      ...SCAFFOLD,
    },
    {
      ...createText(x0 + pad, top + 16),
      width: 300,
      height: 32,
      label: 'Summary',
      textSize: 'sm',
      textBold: true,
      textColor: MUTED,
      textAlignX: 'left',
      ...SCAFFOLD,
    },
    {
      ...createText(x0 + pad, top + 50),
      width: summaryW - pad * 2,
      height: h - 50 - 58,
      label: PM_SUMMARY,
      textSize: 'sm',
      textColor: INK,
      textAlignX: 'left',
      textAlignY: 'top',
      ...CONTENT,
    },
    {
      ...createShape('square', x0 + pad, top + h - 50),
      width: summaryW - pad * 2,
      height: 1,
      fillColor: RULE,
      strokeColor: RULE,
      themeLockFill: true,
      ...SCAFFOLD,
    },
    {
      ...createText(x0 + pad, top + h - 44),
      width: summaryW - pad * 2,
      height: 30,
      label: PM_META,
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
      ...CONTENT,
    },
    {
      ...createShape('callout', x0 + summaryW + gap, top),
      width: calloutW,
      height: h,
      pageTitle: 'Blameless',
      label: PM_BLAMELESS,
      iconId: 'shield',
      textSize: 'sm',
      fillColor: '#ecfeff',
      strokeColor: '#0e7490',
      textColor: '#083344',
      themeLockFill: true,
      ...SCAFFOLD,
    },
    {
      ...createShape('stat-row', statsX, top),
      width: x0 + WIDTH - statsX,
      height: h,
      borderRadius: 'md',
      stats: PM_STATS.map((s) => ({ ...s })),
      ...CONTENT,
    },
  ];
}

const FINDING_PAD = 18;
const FINDING_HEAD_H = 62;
const NOTE_H = 64;
const NOTE_GAP = 10;

function findingsHeight(): number {
  const notes = Math.max(...PM_FINDINGS.map((c) => c.notes.length));
  return FINDING_PAD * 2 + FINDING_HEAD_H + notes * NOTE_H + (notes - 1) * NOTE_GAP;
}

// Contributing factors, what went well and where we got lucky: three tinted
// columns of notes in their column's hue, like a retro's.
function findings(x0: number, top: number, w: number, h: number): Element[] {
  const gap = 20;
  const colW = (w - gap * (PM_FINDINGS.length - 1)) / PM_FINDINGS.length;
  const elements: Element[] = [];
  PM_FINDINGS.forEach((col, i) => {
    const x = x0 + i * (colW + gap);
    elements.push(
      {
        ...createShape('square', x, top),
        width: colW,
        height: h,
        fillColor: col.hue.soft,
        strokeColor: col.hue.line,
        borderRadius: 'md',
        ...SCAFFOLD,
      },
      {
        ...createShape('icon', x + FINDING_PAD, top + FINDING_PAD + 2),
        width: 26,
        height: 26,
        iconId: col.icon,
        strokeColor: col.hue.deep,
        ...SCAFFOLD,
      },
      {
        ...createText(x + FINDING_PAD + 36, top + FINDING_PAD - 2),
        width: colW - FINDING_PAD * 2 - 36,
        height: 34,
        label: col.title,
        textSize: 'md',
        textBold: true,
        textColor: col.hue.deep,
        textAlignX: 'left',
        ...SCAFFOLD,
      },
      {
        ...createText(x + FINDING_PAD, top + FINDING_PAD + 34),
        width: colW - FINDING_PAD * 2,
        height: 24,
        label: col.hint,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'left',
        ...SCAFFOLD,
      },
    );
    col.notes.forEach((note, j) => {
      elements.push({
        ...createSticky(
          x + FINDING_PAD,
          top + FINDING_PAD + FINDING_HEAD_H + j * (NOTE_H + NOTE_GAP),
        ),
        width: colW - FINDING_PAD * 2,
        height: NOTE_H,
        label: note,
        textSize: 'md',
        fillColor: col.sticky.fill,
        textColor: col.sticky.ink,
        ...CONTENT,
      });
    });
  });
  // Luck is not a plan: a four-leaf clover on the column that says so.
  const size = 48;
  elements.push({
    ...createShape('sticker', x0 + w - FINDING_PAD - size + 6, top + 8),
    width: size,
    height: size,
    stickerId: 'emoji-clover',
    rotation: 8,
    ...CONTENT,
  });
  return elements;
}

const ACTION_ROW_H = 46;
const HEAD_ROW: TableCellStyle = { bg: '#e2e8f0', textColor: INK, bold: true };
const BODY: TableCellStyle = { bg: PAPER, textColor: INK };
const TICKET: TableCellStyle = { bg: PAPER, textColor: '#0369a1', bold: true };

// The follow-ups as a table: priority chip colours, then what, who, when
// and the ticket that tracks it.
function actionItems(x0: number, top: number, w: number): Element[] {
  const cellStyles = PM_ACTIONS.map((row, r) =>
    row.map((cell, c): TableCellStyle => {
      if (r === 0)
        return { ...HEAD_ROW, ...(c === 1 || c === 2 ? { alignX: 'left' as const } : {}) };
      if (c === 0) {
        const p = PM_PRIORITY[cell]!;
        return { bg: p.bg, textColor: p.ink, bold: true, alignX: 'center' };
      }
      const align = c === 1 || c === 2 ? { alignX: 'left' as const } : {};
      return { ...(c === 4 ? TICKET : BODY), ...align };
    }),
  );
  return [
    ...sectionHeading(
      x0,
      top,
      w,
      'check-circle',
      'Action items',
      'P1s land before the next checkout release',
    ),
    {
      ...createTable(x0, top + SECTION_H + HEADING_GAP),
      width: w,
      height: PM_ACTIONS.length * ACTION_ROW_H,
      cells: PM_ACTIONS.map((row) => [...row]),
      cellStyles,
      headerRow: true,
      textSize: 'md',
      strokeColor: RULE,
      colWidths: [110, null, 220, 120, 150],
      ...CONTENT,
    },
  ];
}
