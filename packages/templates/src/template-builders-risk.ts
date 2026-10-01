// The risk matrix template (docs/specs/008-canvas/canvas-and-palette.md
// "Templates"): a 5x5 likelihood x impact heatmap for Plateful's group
// ordering launch (template-risk-data.ts holds the register).
//
// The heatmap's cells shade from green through amber to red by score, each
// carrying its score in the corner; the axis steps are named in words with
// the yardstick the team scores against (a probability, a cost), and a
// legend under the grid names the four score bands. Numbered markers R1 to
// R6 sit in their cells, and R1 carries a dashed arrow to the hollow marker
// of its residual position after mitigation. Beside the grid, the risk
// register lists each risk, highest score first, with its score chip,
// owner, mitigation and trend, and a sticky books the next review.
//
// The heatmap's fills are locked (themeLockFill): a theme that repainted
// every cell one colour would erase what the matrix means.
//
// Layers: the "Matrix" scaffold is the grid, its axes and legend; "Risks"
// holds the markers, the residual move, the register and the review note.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createPinnedArrow,
  createShape,
  createSticky,
  createTable,
  createText,
  type Element,
  type TableCellStyle,
} from '@livediagram/document';
import { techHeader, TECH_HEADER_H } from './template-builders-technical-kit';
import {
  IMPACT_STEPS,
  LIKELIHOOD_STEPS,
  RISK_BANDS,
  RISK_CAPTION,
  RISK_CHECKS,
  RISK_LAUNCH,
  RISK_NOTE,
  RISK_TITLE,
  RISKS,
  SCORE_FILL,
  TREND,
  bandOf,
  type Risk,
} from './template-risk-data';
import {
  CONTENT,
  INK,
  MUTED,
  PAPER,
  RULE,
  SCAFFOLD,
  SECTION_H,
  chipRow,
  sectionHeading,
} from './template-report-kit';

const CELL_W = 124;
const CELL_H = 96;
const CELL_GAP = 6;
const AXIS_W = 176; // the Likelihood title plus the row labels
const GRID_W = 5 * CELL_W + 4 * CELL_GAP;
const GRID_H = 5 * CELL_H + 4 * CELL_GAP;
const COL_LABELS_H = 56;
const AXIS_TITLE_H = 32;
const LEGEND_H = 36;
const MARKER = 42;
const SIDE_GAP = 64;
const ROW_H = 62;
const REGISTER_COLS = [64, null, 132, 170, 330, 124];
const REGISTER_W = 1100;

export function buildRiskMatrix(cx: number, cy: number): Element[] {
  const matrixW = AXIS_W + GRID_W;
  const width = matrixW + SIDE_GAP + REGISTER_W;
  const bodyH = SECTION_H + 16 + GRID_H + COL_LABELS_H + AXIS_TITLE_H + 24 + LEGEND_H;
  const height = TECH_HEADER_H + 28 + bodyH;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const top = y0 + TECH_HEADER_H + 28;
  const gridX = x0 + AXIS_W;
  const gridY = top + SECTION_H + 16;
  const regX = x0 + matrixW + SIDE_GAP;

  const elements: Element[] = [
    ...techHeader(x0, y0, width, RISK_TITLE, RISK_CAPTION, {
      title: CONTENT.layerId,
      caption: SCAFFOLD.layerId,
    }),
    ...chipRow(x0 + width, y0 + 10, [
      {
        w: 132,
        label: `${RISKS.length} open risks`,
        fill: '#f1f5f9',
        stroke: '#cbd5e1',
        ink: '#334155',
      },
      { w: 184, label: RISK_LAUNCH, fill: '#e0f2fe', stroke: '#7dd3fc', ink: '#0c4a6e' },
    ]),
    ...sectionHeading(x0, top, matrixW, 'activity', 'Heatmap', 'Likelihood × impact'),
    ...grid(gridX, gridY),
    ...axes(x0, gridX, gridY),
    ...legend(gridX, gridY + GRID_H + COL_LABELS_H + AXIS_TITLE_H + 24),
    ...markers(gridX, gridY),
    ...sectionHeading(regX, top, REGISTER_W, 'clipboard', 'Risk register', 'Highest score first'),
    ...register(regX, gridY),
  ];
  return elements;
}

// The centre of the cell at (likelihood, impact), both 1 to 5, with
// likelihood rising up the grid and impact rising to the right.
const cellAt = (gridX: number, gridY: number, likelihood: number, impact: number) => ({
  x: gridX + (impact - 1) * (CELL_W + CELL_GAP),
  y: gridY + (5 - likelihood) * (CELL_H + CELL_GAP),
});

// Twenty-five tiles, each shaded by its own score, its score in the corner
// in the band's ink.
function grid(gridX: number, gridY: number): Element[] {
  const elements: Element[] = [];
  for (let likelihood = 5; likelihood >= 1; likelihood--) {
    for (let impact = 1; impact <= 5; impact++) {
      const score = likelihood * impact;
      const { x, y } = cellAt(gridX, gridY, likelihood, impact);
      const fill = SCORE_FILL[score]!;
      elements.push({
        ...createShape('square', x, y),
        width: CELL_W,
        height: CELL_H,
        label: String(score),
        textSize: 'sm',
        textBold: true,
        textAlignX: 'left',
        textAlignY: 'top',
        textColor: bandOf(score).ink,
        fillColor: fill,
        strokeColor: fill,
        borderRadius: 'sm',
        themeLockFill: true,
        ...SCAFFOLD,
      });
    }
  }
  return elements;
}

// The step names and yardsticks on both axes, and the two axis titles.
function axes(x0: number, gridX: number, gridY: number): Element[] {
  const elements: Element[] = [];
  const labelX = x0 + 40;
  const labelW = AXIS_W - 40 - 14;
  LIKELIHOOD_STEPS.forEach((step, i) => {
    const { y } = cellAt(gridX, gridY, i + 1, 1);
    elements.push(
      {
        ...createText(labelX, y + CELL_H / 2 - 24),
        width: labelW,
        height: 24,
        label: step.name,
        textSize: 'sm',
        textBold: true,
        textAlignX: 'right',
        ...SCAFFOLD,
      },
      {
        ...createText(labelX, y + CELL_H / 2),
        width: labelW,
        height: 22,
        label: `${i + 1} · ${step.scale}`,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'right',
        ...SCAFFOLD,
      },
    );
  });
  const labelsY = gridY + GRID_H + 8;
  IMPACT_STEPS.forEach((step, i) => {
    const { x } = cellAt(gridX, gridY, 1, i + 1);
    elements.push(
      {
        ...createText(x - 8, labelsY),
        width: CELL_W + 16,
        height: 24,
        label: step.name,
        textSize: 'sm',
        textBold: true,
        ...SCAFFOLD,
      },
      {
        ...createText(x - 8, labelsY + 24),
        width: CELL_W + 16,
        height: 22,
        label: `${i + 1} · ${step.scale}`,
        textSize: 'sm',
        textColor: MUTED,
        ...SCAFFOLD,
      },
    );
  });
  // The Likelihood title runs up the left edge: a text box as long as the
  // grid is tall, turned a quarter to read bottom to top.
  const titleX = x0 + 14;
  elements.push(
    {
      ...createText(titleX - GRID_H / 2 + AXIS_TITLE_H / 2, gridY + GRID_H / 2 - AXIS_TITLE_H / 2),
      width: GRID_H,
      height: AXIS_TITLE_H,
      label: 'Likelihood  →',
      textSize: 'md',
      textBold: true,
      rotation: -90,
      ...SCAFFOLD,
    },
    {
      ...createText(gridX, labelsY + COL_LABELS_H),
      width: GRID_W,
      height: AXIS_TITLE_H,
      label: 'Impact  →',
      textSize: 'md',
      textBold: true,
      ...SCAFFOLD,
    },
  );
  return elements;
}

// The four score bands as chips, then the two marker styles.
function legend(gridX: number, y: number): Element[] {
  const chipW = (GRID_W - 3 * 8) / 4;
  return RISK_BANDS.map((b, i) => ({
    ...createShape('stadium', gridX + i * (chipW + 8), y),
    width: chipW,
    height: LEGEND_H,
    label: `${b.band} · ${b.range}`,
    textSize: 'sm',
    textBold: true,
    fillColor: b.bg,
    strokeColor: b.bg,
    textColor: b.ink,
    themeLockFill: true,
    ...SCAFFOLD,
  }));
}

// A risk's marker: a solid ink disc with its id, or for a residual position
// a hollow dashed ring the solid one points at.
function marker(x: number, y: number, id: string, residual = false): Element {
  return {
    ...createShape('circle', x, y),
    width: MARKER,
    height: MARKER,
    label: id,
    textSize: 'sm',
    textBold: true,
    fillColor: residual ? PAPER : INK,
    strokeColor: residual ? INK : PAPER,
    textColor: residual ? INK : PAPER,
    strokeWidth: residual ? 'medium' : 'thick',
    ...(residual ? { strokeStyle: 'dashed' as const } : {}),
    themeLockFill: true,
    shadow: { offsetX: 0, offsetY: 2, blur: 6, opacity: 0.24 },
    ...CONTENT,
  };
}

function markers(gridX: number, gridY: number): Element[] {
  const elements: Element[] = [];
  const place = (likelihood: number, impact: number) => {
    const { x, y } = cellAt(gridX, gridY, likelihood, impact);
    return { x: x + (CELL_W - MARKER) / 2, y: y + (CELL_H - MARKER) / 2 + 6 };
  };
  for (const risk of RISKS) {
    const at = place(risk.likelihood, risk.impact);
    const disc = marker(at.x, at.y, risk.id);
    elements.push(disc);
    if (!risk.residual) continue;
    const to = place(risk.residual.likelihood, risk.residual.impact);
    const ghost = marker(to.x, to.y, risk.id, true);
    elements.push(ghost, {
      ...createPinnedArrow(disc.id, 'w', ghost.id, 'n'),
      arrowStyle: 'curved',
      curveOffset: { dx: -28, dy: -28 },
      // The move crosses other cells on purpose: the heatmap is the point.
      routeBehind: false,
      strokeColor: INK,
      strokeWidth: 3,
      strokeStyle: 'dashed',
      arrowheadColor: INK,
      ...CONTENT,
    });
  }
  return elements;
}

const HEAD: TableCellStyle = { bg: '#e2e8f0', textColor: INK, bold: true };
const BODY: TableCellStyle = { bg: PAPER, textColor: INK };
const LEFT = { alignX: 'left' as const };

function scoreCell(risk: Risk): string {
  const score = risk.likelihood * risk.impact;
  if (!risk.residual) return `${score} ${bandOf(score).band}`;
  return `${score} → ${risk.residual.likelihood * risk.residual.impact}`;
}

// The register: one row per risk, score chip in its band's colours, trend
// in red, slate or green.
function register(x: number, y: number): Element[] {
  const cells = [
    ['ID', 'Risk', 'Score', 'Owner', 'Mitigation', 'Trend'],
    ...RISKS.map((r) => [r.id, r.risk, scoreCell(r), r.owner, r.mitigation, TREND[r.trend].label]),
  ];
  const cellStyles = cells.map((row, i): TableCellStyle[] => {
    if (i === 0) return row.map((_, c) => ({ ...HEAD, ...(c === 1 || c === 4 ? LEFT : {}) }));
    const risk = RISKS[i - 1]!;
    const band = bandOf(risk.likelihood * risk.impact);
    return [
      { ...BODY, bold: true },
      { ...BODY, ...LEFT },
      { bg: band.bg, textColor: band.ink, bold: true },
      BODY,
      { ...BODY, ...LEFT },
      { bg: PAPER, textColor: TREND[risk.trend].ink, bold: true },
    ];
  });
  const tableH = cells.length * ROW_H;
  // Under the register, level with the grid's legend: the review note, the
  // checks the review runs, and a dot vote on which risk to tackle first.
  const lowerY = y + tableH + 32;
  const lowerH = 30 + RISK_CHECKS.length * 40 + 24;
  const noteW = 400;
  const checksW = 420;
  const voteW = REGISTER_W - noteW - checksW - 2 * 32;
  const checksX = x + noteW + 32;
  const voteX = checksX + checksW + 32;
  return [
    {
      ...createTable(x, y),
      width: REGISTER_W,
      height: tableH,
      cells,
      cellStyles,
      headerRow: true,
      textSize: 'md',
      strokeColor: RULE,
      colWidths: [...REGISTER_COLS],
      ...CONTENT,
    },
    {
      ...createSticky(x, lowerY - 4),
      width: noteW,
      height: lowerH + 4,
      label: RISK_NOTE,
      textSize: 'md',
      fillColor: '#fde68a',
      textColor: '#451a03',
      ...CONTENT,
    },
    {
      ...createShape('sticker', x + noteW - 44, lowerY - 24),
      width: 60,
      height: 60,
      stickerId: 'badge-at-risk',
      rotation: 6,
      ...CONTENT,
    },
    {
      ...createText(checksX, lowerY - 4),
      width: checksW,
      height: 30,
      label: 'Before the review',
      textSize: 'sm',
      textBold: true,
      textAlignX: 'left',
      ...SCAFFOLD,
    },
    {
      ...createShape('checklist', checksX, lowerY + 30),
      width: checksW,
      height: lowerH - 30,
      checklistItems: RISK_CHECKS.map((c) => ({ ...c })),
      ...CONTENT,
    },
    {
      ...createText(voteX, lowerY - 4),
      width: voteW,
      height: 30,
      label: 'Tackle first?',
      textSize: 'sm',
      textBold: true,
      textAlignX: 'left',
      ...SCAFFOLD,
    },
    {
      ...createShape('session-button', voteX, lowerY + 30),
      width: voteW,
      height: 96,
      session: { tool: 'vote', dots: 2 },
      ...CONTENT,
    },
  ];
}
