// Tree-scaffold templates beyond the org chart: the OKR goal tree here, and
// the website sitemap in ./template-builders-sitemap (re-exported below so
// imports stay put). The org chart itself lives in
// ./template-builders-trees.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh
// Element[]. See docs/specs/008-canvas/canvas-and-palette.md "Templates" for the catalogue.

import {
  createPinnedArrow,
  createShape,
  createText,
  runsPlainText,
  type Element,
  type ShapeElement,
  type TextRun,
} from '@livediagram/document';
import { BOTTOM_EXITS, rake } from './template-rake';

export { buildSitemap } from './template-builders-sitemap';

// OKR tree: a quarter's OKRs as the team would actually track them. One
// objective (bold, a target glyph, its owner and quarter) over three key
// results, each a card with a PROGRESS RING showing how far it is from
// baseline to target, the result in bold ("NPS 40 → 55"), and
// the current reading and owner beneath. The ring and the card's hue say
// whether it is on track: green for on track, amber for at risk, in the
// status presets, which read the same under every theme. Under each key
// result hang the two initiatives meant to move it, each tagged with a
// DONE / WIP / TO DO badge, so the tree answers the weekly check-in
// question ("which bets are live, and are they working?") at a glance.
// Connectors are square rakes without arrowheads: a goal tree shows what
// rolls up into what, not a flow.
type KeyResult = {
  result: string;
  now: string;
  owner: string;
  progress: number;
  status: 'success' | 'warning';
  initiatives: [string, string][];
};

const KEY_RESULTS: KeyResult[] = [
  {
    result: 'KR1 · NPS 40 → 55',
    now: 'Now 49 · on track',
    owner: 'Sam',
    progress: 60,
    status: 'success',
    initiatives: [
      ['Revamp onboarding', 'badge-done'],
      ['In-app help centre', 'badge-wip'],
    ],
  },
  {
    result: 'KR2 · Activation 25% → 40%',
    now: 'Now 30% · at risk',
    owner: 'Ana',
    progress: 33,
    status: 'warning',
    initiatives: [
      ['Guided first project', 'badge-wip'],
      ['Starter templates', 'badge-todo'],
    ],
  },
  {
    result: 'KR3 · Churn 3.1% → 2%',
    now: 'Now 2.4% · on track',
    owner: 'Leo',
    progress: 75,
    status: 'success',
    initiatives: [
      ['Win-back emails', 'badge-done'],
      ['Exit-survey insights', 'badge-wip'],
    ],
  },
];

const MUTED = '#64748b';
// Goal-tree lines show what rolls up into what: no arrowheads.
const LINE = { arrowEnds: 'none', arrowStyle: 'angled' } as const;

export function buildOkrTree(cx: number, cy: number): Element[] {
  const objW = 520;
  const objH = 96;
  const krW = 360;
  const krH = 124;
  const krGap = 36;
  const ringD = 84;
  const pad = 20;
  const initW = 160;
  const initH = 64;
  const titleH = 44;
  const captionH = 28;
  const levelGap = 72;
  const totalW = krW * 3 + krGap * 2;
  const totalH = titleH + captionH + 32 + objH + levelGap + krH + levelGap + initH;
  const left = cx - totalW / 2;
  const top = cy - totalH / 2;
  const objY = top + titleH + captionH + 32;
  const krY = objY + objH + levelGap;
  const initY = krY + krH + levelGap;

  const elements: Element[] = [
    {
      ...createText(left, top),
      width: totalW,
      height: titleH,
      label: 'Q3 OKRs · Growth team',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(left, top + titleH),
      width: totalW,
      height: captionH,
      label:
        'Objective: where we want to be. Key results: how we will know (the ring is progress to target). Initiatives: our bets.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
  ];
  const arrows: Element[] = [];

  const objRuns: TextRun[] = [
    { text: 'Make self-serve customers successful', bold: true },
    { text: '\nObjective · Owner: Dana Kim', size: 'sm' },
  ];
  const objective: ShapeElement = {
    ...createShape('square', cx - objW / 2, objY),
    width: objW,
    height: objH,
    label: runsPlainText(objRuns),
    richText: objRuns,
    textSize: 'md',
    iconId: 'target',
    // The objective anchors the whole tree: the hero preset.
    colorPreset: 'bold',
  };
  elements.push(objective);

  KEY_RESULTS.forEach((kr, i) => {
    const x = left + i * (krW + krGap);
    // The card is the node the lines pin to; the ring and the text sit on
    // it, so it reads as one KR.
    const card: ShapeElement = {
      ...createShape('square', x, krY),
      width: krW,
      height: krH,
      label: '',
      colorPreset: kr.status,
    };
    const ring: ShapeElement = {
      ...createShape('progress-ring', x + pad, krY + (krH - ringD) / 2),
      width: ringD,
      height: ringD,
      progress: kr.progress,
      colorPreset: kr.status,
    };
    const runs: TextRun[] = [
      { text: kr.result, bold: true },
      { text: `\n${kr.now}\nOwner: ${kr.owner}`, size: 'sm' },
    ];
    const textX = x + pad + ringD + 16;
    elements.push(card, ring, {
      ...createText(textX, krY + pad - 4),
      width: x + krW - pad - textX,
      height: krH - (pad - 4) * 2,
      label: runsPlainText(runs),
      richText: runs,
      textSize: 'sm',
      textAlignX: 'left',
      textAlignY: 'middle',
    });
    const [anchor, fx] = BOTTOM_EXITS[i]!;
    arrows.push({
      ...createPinnedArrow(objective.id, anchor, card.id, 'n'),
      ...LINE,
      curvePoints: rake({ x: objective.x + objW * fx, y: objY + objH }, { x: x + krW / 2, y: krY }),
    });

    // Two initiatives under each KR, each centred under its own quarter of
    // the card so its line drops straight, with its status badge stuck on
    // the top-right corner.
    kr.initiatives.forEach(([label, badge], j) => {
      const ix = x + krW * (j === 0 ? 0.25 : 0.75) - initW / 2;
      const init: ShapeElement = {
        ...createShape('square', ix, initY),
        width: initW,
        height: initH,
        label,
        textSize: 'sm',
      };
      const badgeH = 24;
      elements.push(init, {
        ...createShape('sticker', ix + initW - badgeH * 2.2, initY - badgeH / 2 - 2),
        width: badgeH * 2.5,
        height: badgeH,
        stickerId: badge,
        rotation: j === 0 ? -3 : 3,
      });
      arrows.push({
        ...createPinnedArrow(card.id, j === 0 ? 'ssw' : 'sse', init.id, 'n'),
        ...LINE,
        curvePoints: rake(
          { x: x + krW * (j === 0 ? 0.25 : 0.75), y: krY + krH },
          { x: ix + initW / 2, y: initY },
        ),
      });
    });
  });

  return [...elements, ...arrows];
}
