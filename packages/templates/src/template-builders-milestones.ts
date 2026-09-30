// The horizontal milestone timeline (docs/specs/008-canvas/canvas-and-palette.md "Templates"),
// plus the card and layering helpers it shares with its vertical sibling
// (template-builders-milestones-vertical.ts). The two are the presentation
// pieces of the timeline family, split out of template-builders-timelines.ts
// once each grew a story of its own. The quick Timeline there is the
// status-at-a-glance line (evenly spaced status dots, a Today marker); these
// two are told, not tracked:
//
// - Horizontal: one product's launch year, placed to scale on a segmented
//   PHASE RIBBON (Discover / Build / Launch / Grow), each milestone a callout
//   card on a pinned stem with its date chip, and launch day as the hero.
// - Vertical: a company history read down the page, the classic alternating
//   layout: a big year on one side of the spine, the story card on the other,
//   a glyph disc on the spine, a highlight moment and a dashed "next chapter".
//
// Both builders are pure: (cx, cy) -> Element[]. The title, caption and spine
// (or ribbon) are the "Spine" scaffold layer; everything a milestone owns
// rides the "Milestones" content layer.
import {
  createArrow,
  createPinnedArrow,
  createShape,
  createText,
  type Element,
} from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

export const MUTED = '#64748b';

export type Shape = Extract<Element, { type: 'shape' }>;

// A milestone card: a callout (docs/specs/009-elements/web-components-and-no-groups.md), so the
// glyph badge, heading and story line are ONE element that drags as one and
// keeps its pinned stem.
export function milestoneCard(
  x: number,
  y: number,
  w: number,
  h: number,
  heading: string,
  body: string,
  iconId: string,
  accent: string,
): Shape {
  return {
    ...createShape('callout', x, y),
    width: w,
    height: h,
    pageTitle: heading,
    label: body,
    iconId,
    textSize: 'sm',
    strokeColor: accent,
  } as Shape;
}

export const layered = (scaffold: Element[], content: Element[]): Element[] => [
  ...scaffold.map((el) => ({ ...el, layerId: TEMPLATE_SCAFFOLD_LAYER_ID })),
  ...content.map((el) => ({ ...el, layerId: TEMPLATE_CONTENT_LAYER_ID })),
];

// Horizontal milestone timeline: "Tandem's launch year". The spine is a
// ribbon of four phase segments laid to scale over the twelve months, so a
// milestone's distance along it IS its date (unlike the quick Timeline's
// even spacing). Six milestones alternate above and below the ribbon: a disc
// on the ribbon's edge in the phase's hue, a pinned stem (dragging a card
// keeps it attached), a date chip riding the stem, and a callout card with a
// glyph, a heading and one line of what actually happened. Launch day is the
// hero: a larger, heavier card with a rocket and a party popper on it.
export function buildMilestoneTimeline(cx: number, cy: number): Element[] {
  const width = 1400;
  const monthW = width / 12;
  const ribbonH = 44;
  const segGap = 6;
  const dot = 20;
  const chipW = 104;
  const chipH = 28;
  const chipOffset = 48; // ribbon edge -> chip centre
  const cardOffset = 78; // ribbon edge -> near card edge
  const cardW = 264;
  // Callout headings scale with card height: these heights put the heading
  // a step above the 14px story line so it reads first.
  const cardH = 116;
  const heroW = 312;
  const heroH = 136;

  const left = cx - width / 2;
  const ribbonTop = cy - ribbonH / 2;
  const ribbonBottom = cy + ribbonH / 2;
  const atMonth = (m: number) => left + m * monthW;

  const phases = [
    { name: 'Discover', from: 0, to: 2, tint: '#ede9fe', deep: '#6d28d9' },
    { name: 'Build', from: 2, to: 5, tint: '#dbeafe', deep: '#1d4ed8' },
    { name: 'Launch', from: 5, to: 7, tint: '#fef3c7', deep: '#b45309' },
    { name: 'Grow', from: 7, to: 12, tint: '#d1fae5', deep: '#047857' },
  ];
  const phaseAt = (m: number) => phases.find((p) => m >= p.from && m < p.to)!;

  // `month` is the date as a fractional month index (0 = 1 January).
  const milestones: {
    month: number;
    date: string;
    title: string;
    note: string;
    icon: string;
    hero?: boolean;
  }[] = [
    {
      month: 0.33,
      date: '11 Jan',
      title: 'Kick-off',
      note: 'Six people, one question: why do shared lists drift?',
      icon: 'flag',
    },
    {
      month: 1.85,
      date: '26 Feb',
      title: 'Prototype tested',
      note: '8 of 10 testers shared a list without any help',
      icon: 'users',
    },
    {
      month: 4.55,
      date: '18 May',
      title: 'Private beta',
      note: '400 teams in from the waitlist, NPS 52',
      icon: 'smartphone',
    },
    {
      month: 6.2,
      date: '7 Jul',
      title: 'Launch day',
      note: '#2 on Product Hunt and 3,200 sign-ups in 24 hours',
      icon: 'star',
      hero: true,
    },
    {
      month: 8.97,
      date: '30 Sep',
      title: '10,000 teams',
      note: 'Day-30 retention holding at 62%',
      icon: 'trending-up',
    },
    {
      month: 11,
      date: '1 Dec',
      title: 'Year-two plan',
      note: 'Android widget and shared budgets',
      icon: 'calendar',
    },
  ];

  const scaffold: Element[] = [];
  const content: Element[] = [];

  // The title lines up with the leftmost card, which overhangs the ribbon.
  const titleX = Math.min(left, ...milestones.map((m) => atMonth(m.month) - cardW / 2));
  const titleY = ribbonTop - cardOffset - cardH - 100;
  scaffold.push(
    {
      ...createText(titleX, titleY),
      width: width,
      height: 48,
      label: 'Tandem · the launch year, 2027',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(titleX, titleY + 48),
      width: width,
      height: 28,
      label:
        'Milestones sit where they happened on the year. Drag a card to re-hang it; its stem follows.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
  );

  // The ribbon: one pill per phase, gapped so the phase boundaries read.
  for (const p of phases) {
    scaffold.push({
      ...createShape('stadium', atMonth(p.from) + segGap / 2, ribbonTop),
      width: (p.to - p.from) * monthW - segGap,
      height: ribbonH,
      label: p.name,
      textSize: 'sm',
      textBold: true,
      fillColor: p.tint,
      strokeColor: p.tint,
      textColor: p.deep,
      // The phase hue is what ties each milestone to its phase.
      themeLockFill: true,
    });
  }
  // Time runs on past the plan: an arrowhead off the ribbon's end.
  scaffold.push({
    ...createArrow(atMonth(12) + 4, cy, atMonth(12) + 44, cy),
    strokeColor: '#64748b',
    strokeWidth: 3,
    routeBehind: false,
  });

  milestones.forEach((m, i) => {
    const phase = phaseAt(m.month);
    const x = atMonth(m.month);
    const above = i % 2 === 0;
    const edge = above ? ribbonTop : ribbonBottom;
    const dir = above ? -1 : 1;
    const w = m.hero ? heroW : cardW;
    const h = m.hero ? heroH : cardH;
    const disc: Shape = {
      ...createShape('circle', x - dot / 2, edge - dot / 2),
      width: dot,
      height: dot,
      label: '',
      fillColor: '#ffffff',
      strokeColor: phase.deep,
      strokeWidth: 'thick',
    };
    const cardY = above ? edge - cardOffset - h : edge + cardOffset;
    const card = milestoneCard(x - w / 2, cardY, w, h, m.title, m.note, m.icon, phase.deep);
    if (m.hero) card.strokeWidth = 'thick';
    content.push(
      {
        ...createPinnedArrow(disc.id, above ? 'n' : 's', card.id, above ? 's' : 'n'),
        arrowEnds: 'none',
        strokeColor: phase.deep,
        strokeWidth: 2,
        routeBehind: false,
      },
      disc,
      {
        ...createShape('stadium', x - chipW / 2, edge + dir * chipOffset - chipH / 2),
        width: chipW,
        height: chipH,
        label: m.date,
        textSize: 'sm',
        textBold: true,
        fillColor: '#ffffff',
        strokeColor: phase.deep,
        textColor: phase.deep,
      },
      card,
    );
    if (m.hero) {
      content.push(
        {
          ...createShape('sticker', x + w / 2 - 40, cardY + h - 34),
          width: 60,
          height: 60,
          stickerId: 'emoji-rocket',
          rotation: 8,
        },
        {
          ...createShape('sticker', x - w / 2 - 22, cardY + h - 30),
          width: 48,
          height: 48,
          stickerId: 'emoji-party-popper',
          rotation: -10,
        },
      );
    }
  });

  return layered(scaffold, content);
}
