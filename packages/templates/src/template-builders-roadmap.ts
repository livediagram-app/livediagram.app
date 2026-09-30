// Roadmap template builder (docs/specs/008-canvas/canvas-and-palette.md "Templates"): the strategic,
// date-light sibling of the Gantt (template-builders-gantt.ts).
//
// An outcome roadmap the way product teams actually run one: a single goal
// at the top says what the year is for, three horizon columns (Now / Next /
// Later) say how sure we are, and three theme swimlanes (Activation /
// Collaboration / Reliability, real `lane` elements with their names in the
// gutter) say why each bet exists. Every card is an initiative plus the
// outcome it should move ("Day-1 activation 38% → 50%"), never a bare
// feature name. Confidence is drawn, not just written: each column header
// carries a three-dot confidence meter, Now cards have a firm border, Next a
// normal one and Later a dashed one (a bet, not a promise). Now cards also
// wear a status sticker (SHIPPED / WIP / AT RISK) so the review starts where
// the risk is.
//
// Title, goal, column headers and lanes are the "Lanes" scaffold layer; the
// cards, their text and stickers ride the "Cards" content layer so they drag
// between horizons with the lanes locked. The lane tints are left unlocked,
// like the journey map's bands, so other themes repaint them.
import { createShape, createText, type Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

const MUTED = '#64748b';

type Horizon = { name: string; when: string; confidence: 1 | 2 | 3 };
const HORIZONS: Horizon[] = [
  { name: 'Now', when: 'Jan to Mar · committed', confidence: 3 },
  { name: 'Next', when: 'Apr to Jun · scoped', confidence: 2 },
  { name: 'Later', when: 'Second half · exploring', confidence: 1 },
];

type Card = { title: string; outcome: string; status?: string };
type Theme = {
  name: string;
  fill: string;
  stroke: string;
  header: string;
  deep: string;
  cards: [Card, Card, Card]; // one per horizon
};

const THEMES: Theme[] = [
  {
    name: 'Activation',
    fill: '#f5f3ff',
    stroke: '#c4b5fd',
    header: '#ede9fe',
    deep: '#6d28d9',
    cards: [
      { title: 'Guided first list', outcome: 'Day-1 activation 38% → 50%', status: 'badge-wip' },
      { title: 'Import from Notes + Reminders', outcome: 'Half of new teams start with real data' },
      { title: 'Smart suggestions', outcome: 'Fewer abandoned empty lists' },
    ],
  },
  {
    name: 'Collaboration',
    fill: '#eff6ff',
    stroke: '#93c5fd',
    header: '#dbeafe',
    deep: '#1d4ed8',
    cards: [
      {
        title: 'Live presence + cursors',
        outcome: 'Used weekly by 71% of teams',
        status: 'badge-shipped',
      },
      { title: 'Assign items to people', outcome: 'Top request: 412 votes' },
      { title: 'Shared budgets', outcome: 'Testing with 5 design partners' },
    ],
  },
  {
    name: 'Reliability',
    fill: '#ecfdf5',
    stroke: '#6ee7b7',
    header: '#d1fae5',
    deep: '#047857',
    cards: [
      {
        title: 'Offline sync',
        outcome: 'Sync conflicts under 0.1% of edits',
        status: 'badge-at-risk',
      },
      { title: 'Faster app start', outcome: 'Cold start 2.8s → 1s' },
      { title: 'End-to-end encryption', outcome: 'Unlocks the enterprise pilots' },
    ],
  },
];

// Border weight per horizon: firm, normal, then dashed for the bets.
const CARD_BORDER: { strokeWidth: 'thick' | 'medium'; strokeStyle: 'solid' | 'dashed' }[] = [
  { strokeWidth: 'thick', strokeStyle: 'solid' },
  { strokeWidth: 'medium', strokeStyle: 'solid' },
  { strokeWidth: 'medium', strokeStyle: 'dashed' },
];

export function buildRoadmap(cx: number, cy: number): Element[] {
  const gutter = 184; // the lane's title strip, wide enough for Collaboration
  const colW = 320;
  const colGap = 20;
  const lanePad = 16;
  const cardH = 92;
  const laneH = cardH + lanePad * 2;
  const laneGap = 14;
  const titleH = 48;
  const captionH = 28;
  const goalH = 44;
  const headerH = 64;
  const laneW =
    gutter + lanePad + HORIZONS.length * colW + (HORIZONS.length - 1) * colGap + lanePad;
  const lanesH = THEMES.length * laneH + (THEMES.length - 1) * laneGap;
  const totalH = titleH + captionH + 20 + goalH + 24 + headerH + lanesH;
  const left = cx - laneW / 2;
  const top = cy - totalH / 2;
  const goalY = top + titleH + captionH + 20;
  const headerY = goalY + goalH + 24;
  const lanesTop = headerY + headerH;
  const colX = (i: number) => left + gutter + lanePad + i * (colW + colGap);

  const scaffold: Element[] = [];
  const content: Element[] = [];

  scaffold.push(
    {
      ...createText(left, top),
      width: laneW,
      height: titleH,
      label: 'Tandem product roadmap · 2027',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(left, top + titleH),
      width: laneW,
      height: captionH,
      label:
        'Every card names the outcome it should move, and the dots show how sure we are. Pull a card left when it firms up, push it right when it slips.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
    {
      // The one goal every lane serves: a roadmap without one is a wish list.
      ...createShape('stadium', left, goalY),
      width: 520,
      height: goalH,
      label: 'Goal: 10,000 weekly active teams by December',
      iconId: 'target',
      iconPosition: 'left',
      textSize: 'sm',
      textBold: true,
      colorPreset: 'soft',
    },
  );

  // Horizon headers: name, timeframe, and a confidence meter that empties
  // as the horizon gets further away.
  HORIZONS.forEach((h, i) => {
    const x = colX(i);
    scaffold.push(
      {
        ...createText(x, headerY),
        width: colW - 90,
        height: 36,
        label: h.name,
        textSize: 'lg',
        textBold: true,
        textAlignX: 'left',
      },
      {
        ...createText(x, headerY + 34),
        width: colW,
        height: 24,
        label: h.when,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'left',
      },
    );
    for (let d = 0; d < 3; d++) {
      const on = d < h.confidence;
      scaffold.push({
        ...createShape('circle', x + colW - 3 * 20 + d * 20, headerY + 12),
        width: 12,
        height: 12,
        label: '',
        fillColor: on ? '#334155' : '#ffffff',
        strokeColor: '#334155',
        strokeWidth: 'medium',
      });
    }
  });

  THEMES.forEach((theme, t) => {
    const laneY = lanesTop + t * (laneH + laneGap);
    scaffold.push({
      ...createShape('lane', left, laneY),
      width: laneW,
      height: laneH,
      label: theme.name,
      textSize: 'md',
      textBold: true,
      textColor: theme.deep,
      fillColor: theme.fill,
      strokeColor: theme.stroke,
      headerFill: theme.header,
      headerSize: gutter,
    });
    theme.cards.forEach((card, h) => {
      const x = colX(h);
      const y = laneY + lanePad;
      content.push(
        {
          ...createShape('square', x, y),
          width: colW,
          height: cardH,
          label: '',
          borderRadius: 'md',
          strokeColor: theme.stroke,
          ...CARD_BORDER[h],
        },
        {
          ...createText(x + 16, y + 14),
          width: colW - 32 - (card.status ? 70 : 0),
          height: 30,
          label: card.title,
          textSize: 'sm',
          textBold: true,
          textAlignX: 'left',
        },
        {
          ...createText(x + 16, y + 46),
          width: colW - 32,
          height: 30,
          label: card.outcome,
          textSize: 'sm',
          textColor: MUTED,
          textAlignX: 'left',
        },
      );
      if (card.status) {
        const badgeH = 24;
        content.push({
          ...createShape('sticker', x + colW - badgeH * 2.5 - 10, y + 12),
          width: badgeH * 2.5,
          height: badgeH,
          stickerId: card.status,
          rotation: 3,
        });
      }
    });
  });

  return [
    ...scaffold.map((el) => ({ ...el, layerId: TEMPLATE_SCAFFOLD_LAYER_ID })),
    ...content.map((el) => ({ ...el, layerId: TEMPLATE_CONTENT_LAYER_ID })),
  ];
}
