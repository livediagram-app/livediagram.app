// The opportunity solution tree template (docs/specs/008-canvas/canvas-and-palette.md
// "Templates"): Teresa Torres's continuous-discovery tree for one team
// outcome, with its worked content in ./template-opportunity-tree-data.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createPinnedArrow,
  createShape,
  createText,
  runsPlainText,
  type Anchor,
  type Element,
  type ShapeElement,
  type TextRun,
} from '@livediagram/document';
import { BOTTOM_EXITS, rake } from './template-rake';
import {
  CONTENT,
  MUTED,
  SCAFFOLD,
  SUBTITLE_H,
  TITLE_H,
  chip,
  titleBlock,
} from './template-discovery-parts';
import {
  INTERVIEWS,
  LEVELS,
  OPPORTUNITIES,
  OUTCOME,
  PARENT_INDEX,
  SOLUTIONS,
  STATUS,
  SUB_OPPORTUNITIES,
  TARGET_INDEX,
  type Level,
  type Opportunity,
} from './template-opportunity-tree-data';

// The tree reads top-down in the method's four levels, and a rail down the
// left names each one, so it reads by row before it reads by card: the
// desired outcome (a hero card with its metric and a progress ring), the
// opportunities in the customer's own words (each with an evidence chip,
// "Heard in 7 of 12 interviews", and the middle one broken into three
// sub-opportunities), the target opportunity marked with a star ribbon and
// solid fill, the three solutions compared under it, and two assumption
// tests under each solution with a Running / Validated / Invalidated chip.
// Every row sits on a wash of its level's hue and every card is edged in
// it; connectors are the shared square rake without arrowheads, since a
// tree shows what serves what, not a flow. The washes, rail and how-to are
// the "Levels" scaffold; title, cards, chips and lines ride "Tree".

const INK = '#0f172a';
const WHITE = '#ffffff';
const LINE = { arrowEnds: 'none', arrowStyle: 'angled' } as const;

// Geometry, in canvas px.
const RAIL_W = 250;
const RAIL_GAP = 32;
const BAND_PAD = 28;
const BAND_GAP = 16;
const OUTCOME_W = 620;
const OUTCOME_H = 120;
const RING_D = 84;
const OPP_W = 300;
const OPP_H = 136;
const OPP_ROW_GAP = 72;
const GROUP_W = 460;
const GROUP_GAP = 40;
const SOL_H = 96;
const TEST_W = 214;
const TEST_H = 150;
const CHIP_H = 28;
const TREE_W = GROUP_W * 3 + GROUP_GAP * 2;

type Pt = { x: number; y: number };

// A plain card edged in its level's hue, its label top-left as rich text.
function card(
  x: number,
  y: number,
  width: number,
  height: number,
  runs: TextRun[],
  level: Level,
): ShapeElement {
  return {
    ...createShape('square', x, y),
    width,
    height,
    label: runsPlainText(runs),
    richText: runs,
    textSize: 'sm',
    textAlignX: 'left',
    textAlignY: 'top',
    padding: 'md',
    fillColor: WHITE,
    strokeColor: level.hue.edge,
    strokeWidth: 'medium',
    textColor: INK,
    themeLockFill: true,
    ...CONTENT,
  };
}

export function buildOpportunitySolutionTree(cx: number, cy: number): Element[] {
  const headGap = 28;
  const outcomeBandH = BAND_PAD * 2 + OUTCOME_H;
  const oppBandH = BAND_PAD * 2 + OPP_H * 2 + OPP_ROW_GAP;
  const solBandH = BAND_PAD * 2 + SOL_H;
  const testBandH = BAND_PAD * 2 + TEST_H;
  const totalW = RAIL_W + RAIL_GAP + TREE_W;
  const totalH =
    TITLE_H + SUBTITLE_H + headGap + outcomeBandH + oppBandH + solBandH + testBandH + BAND_GAP * 3;
  const x0 = cx - totalW / 2;
  const y0 = cy - totalH / 2;
  const treeX = x0 + RAIL_W + RAIL_GAP;
  const mid = treeX + TREE_W / 2;

  const elements: Element[] = titleBlock(
    x0,
    y0,
    totalW,
    'Plateful · 30-day retention',
    `Read it top-down: one outcome, the needs we heard in ${INTERVIEWS} household interviews, three solutions for the target need, and the tests that de-risk them.`,
  );
  const lines: Element[] = [];
  const connect = (from: ShapeElement, anchor: Anchor, fx: number, to: ShapeElement) => {
    lines.push({
      ...createPinnedArrow(from.id, anchor, to.id, 'n'),
      ...LINE,
      curvePoints: rake({ x: from.x + from.width * fx, y: from.y + from.height } satisfies Pt, {
        x: to.x + to.width / 2,
        y: to.y,
      }),
      ...CONTENT,
    });
  };
  // A parent's three children, each on its own exit.
  const fan = (parent: ShapeElement, children: ShapeElement[]) =>
    children.forEach((child, i) => {
      const [anchor, fx] = BOTTOM_EXITS[i]!;
      connect(parent, anchor, fx, child);
    });

  // Level bands: a faint wash across the whole row, with the rail tile at
  // its left naming the level in its deep hue.
  let bandY = y0 + TITLE_H + SUBTITLE_H + headGap;
  const band = (level: Level, height: number) => {
    const { hue } = level;
    const top = bandY;
    elements.push(
      {
        ...createShape('square', x0, top),
        width: totalW,
        height,
        fillColor: hue.band,
        strokeColor: hue.tile,
        borderRadius: 'lg',
        themeLockFill: true,
        ...SCAFFOLD,
      },
      {
        ...createShape('square', x0, top),
        width: RAIL_W,
        height,
        fillColor: hue.tile,
        strokeColor: hue.tile,
        borderRadius: 'lg',
        themeLockFill: true,
        ...SCAFFOLD,
      },
      {
        ...createShape('icon', x0 + 20, top + 22),
        width: 32,
        height: 32,
        iconId: level.icon,
        strokeColor: hue.edge,
        ...SCAFFOLD,
      },
      {
        ...createText(x0 + 62, top + 20),
        width: RAIL_W - 76,
        height: 36,
        label: level.name,
        textSize: 'md',
        textBold: true,
        textColor: hue.ink,
        textAlignX: 'left',
        ...SCAFFOLD,
      },
      {
        ...createText(x0 + 20, top + 64),
        width: RAIL_W - 40,
        height: 44,
        label: level.rule,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'left',
        textAlignY: 'top',
        ...SCAFFOLD,
      },
    );
    bandY += height + BAND_GAP;
    return top + BAND_PAD;
  };

  // Outcome: the hero card, solid violet, with its progress ring.
  const outcomeY = band(LEVELS.outcome, outcomeBandH);
  const hue = LEVELS.outcome.hue;
  const outcomeRuns: TextRun[] = [
    { text: OUTCOME.title, bold: true, size: 'md' },
    { text: `\n${OUTCOME.detail}`, size: 'sm' },
  ];
  const outcome: ShapeElement = {
    ...createShape('square', mid - OUTCOME_W / 2, outcomeY),
    width: OUTCOME_W,
    height: OUTCOME_H,
    label: '',
    fillColor: hue.ink,
    strokeColor: hue.ink,
    strokeWidth: 'medium',
    textColor: WHITE,
    themeLockFill: true,
    ...CONTENT,
  };
  // The card's own label stays empty: a text element right of the ring
  // carries the words, so the ring never sits on them.
  const ringX = outcome.x + 22;
  elements.push(
    outcome,
    {
      ...createShape('progress-ring', ringX, outcomeY + (OUTCOME_H - RING_D) / 2),
      width: RING_D,
      height: RING_D,
      progress: OUTCOME.progress,
      fillColor: '#7c3aed',
      strokeColor: '#ddd6fe',
      textColor: WHITE,
      themeLockFill: true,
      ...CONTENT,
    },
    {
      ...createText(ringX + RING_D + 20, outcomeY),
      width: OUTCOME_W - (RING_D + 20 + 22) - 22,
      height: OUTCOME_H,
      label: runsPlainText(outcomeRuns),
      richText: outcomeRuns,
      textSize: 'sm',
      textColor: WHITE,
      textAlignX: 'left',
      textAlignY: 'middle',
      ...CONTENT,
    },
  );

  // Opportunities: the customer's words, with the evidence under them.
  const oppLevel = LEVELS.opportunities;
  const oppY = band(oppLevel, oppBandH);
  const opportunity = (x: number, y: number, o: Opportunity, target = false): ShapeElement => {
    const runs: TextRun[] = [{ text: o.quote, size: 'md' }];
    const c = card(x, y, OPP_W, OPP_H, runs, oppLevel);
    const shaped: ShapeElement = target
      ? {
          ...c,
          fillColor: oppLevel.hue.edge,
          strokeColor: oppLevel.hue.ink,
          strokeWidth: 'thick',
          textColor: WHITE,
          // Room under the ribbon that rides the top edge.
          padding: 'lg',
        }
      : c;
    const inset = target ? 24 : 14;
    elements.push(
      shaped,
      chip(
        x + inset,
        y + OPP_H - 14 - CHIP_H,
        220,
        CHIP_H,
        `Heard in ${o.heard} of ${INTERVIEWS} interviews`,
        target
          ? { fill: WHITE, stroke: WHITE, ink: oppLevel.hue.ink }
          : { fill: oppLevel.hue.tile, stroke: oppLevel.hue.tile, ink: oppLevel.hue.ink },
        false,
      ),
    );
    return shaped;
  };
  const oppXs = [treeX, mid - OPP_W / 2, treeX + TREE_W - OPP_W];
  const opps = OPPORTUNITIES.map((o, i) => opportunity(oppXs[i]!, oppY, o));
  fan(outcome, opps);

  const subY = oppY + OPP_H + OPP_ROW_GAP;
  const subPitch = OPP_W + 40;
  const subs = SUB_OPPORTUNITIES.map((o, i) =>
    opportunity(mid - OPP_W / 2 + (i - 1) * subPitch, subY, o, i === TARGET_INDEX),
  );
  fan(opps[PARENT_INDEX]!, subs);
  // The rail explains the second row of the band: why a need gets broken down.
  elements.push({
    ...createText(x0 + 20, subY),
    width: RAIL_W - 40,
    height: OPP_H,
    label:
      'Break a big need into smaller ones until one is small enough to solve. That is the target.',
    textSize: 'sm',
    textColor: MUTED,
    textAlignX: 'left',
    textAlignY: 'top',
    ...SCAFFOLD,
  });
  const target = subs[TARGET_INDEX]!;
  // The target ribbon rides the card's top edge, right of where its line
  // lands, so the line never crosses it.
  const ribbonW = 112;
  elements.push({
    ...createShape('stadium', target.x + OPP_W - 16 - ribbonW, target.y - 16),
    width: ribbonW,
    height: 32,
    label: '★ Target',
    textSize: 'sm',
    textBold: true,
    padding: 'none',
    fillColor: '#fbbf24',
    strokeColor: '#d97706',
    textColor: '#451a03',
    themeLockFill: true,
    ...CONTENT,
  });

  // Solutions: three ways to serve the target, each over its two tests.
  const solLevel = LEVELS.solutions;
  const solY = band(solLevel, solBandH);
  const testLevel = LEVELS.experiments;
  const testY = band(testLevel, testBandH);
  const sols = SOLUTIONS.map((s, i) => {
    const x = treeX + i * (GROUP_W + GROUP_GAP);
    const runs: TextRun[] = [
      { text: s.name, bold: true, size: 'md', color: solLevel.hue.ink },
      { text: `\n${s.pitch}` },
    ];
    const sol: ShapeElement = {
      ...card(x, solY, GROUP_W, SOL_H, runs, solLevel),
      textAlignY: 'middle',
      iconId: s.icon,
    };
    elements.push(sol);

    // Each test is centred under its own quarter of the solution, so its
    // line drops straight from the ssw / sse exit.
    const tests = s.tests.map((t, j) => {
      const tx = x + GROUP_W * (j === 0 ? 0.25 : 0.75) - TEST_W / 2;
      const status = STATUS[t.status];
      const testRuns: TextRun[] = [
        { text: t.assumption, bold: true },
        { text: `\n${t.test}`, color: MUTED },
        { text: `\n${t.result}` },
      ];
      const test = card(tx, testY, TEST_W, TEST_H, testRuns, testLevel);
      elements.push(
        test,
        chip(tx + 14, testY + TEST_H - 14 - CHIP_H, 132, CHIP_H, status.label, {
          fill: status.fill,
          stroke: status.fill,
          ink: status.ink,
        }),
      );
      return test;
    });
    tests.forEach((test, j) => connect(sol, j === 0 ? 'ssw' : 'sse', j === 0 ? 0.25 : 0.75, test));
    return sol;
  });
  fan(target, sols);

  return [...elements, ...lines];
}
