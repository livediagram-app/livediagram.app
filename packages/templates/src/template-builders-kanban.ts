// The Kanban board (docs/specs/008-canvas/canvas-and-palette.md "Templates"), split out of
// template-builders-boards.ts (which re-exports it) once the lanes gained WIP
// limits, owners, tags and a blocked card.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createShape,
  createText,
  runsPlainText,
  type Element,
  type ShapeMarker,
  type TextRun,
} from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

// A board a team is mid-way through, read left to right the way work flows.
// Five tinted lanes (Backlog / To do / In progress / Review / Done), each with
// a deep-hue header, a role glyph, a count chip and a one-line rule. The two
// lanes that cap work in flight say so in their chip ("WIP 3 / 3"), which is
// the one habit that makes a Kanban board more than a to-do list. Every card
// is a white ticket: a bold id lead-in and summary, a coloured tag chip, a
// traffic-light priority chip and the owner's initials, so "what, how urgent,
// who" reads without opening anything. Backlog tickets are still unassigned;
// Done tickets drop the priority (it no longer matters) and the lane ends on
// a trophy and a count, so finishing feels like something. One In progress
// ticket is blocked: a thick red border and a BLOCKED badge, the card a
// standup should talk about first. The lanes are the "Board" scaffold; every
// card part rides the "Cards" content layer so tickets drag between lanes.
type Lane = {
  label: string;
  hint: string;
  chip: string;
  icon: string;
  fill: string;
  stroke: string;
  headerColor: string;
};

type Tag = 'Frontend' | 'Backend' | 'Design' | 'Bug' | 'Infra';
type Priority = 'High' | 'Medium' | 'Low';
type Person = 'AK' | 'SM' | 'LO' | 'JP' | 'RB';
type Card = {
  id: string;
  summary: string;
  tag: Tag;
  priority?: Priority;
  owner?: Person;
  blocked?: boolean;
};

const LANES: { lane: Lane; cards: Card[] }[] = [
  {
    lane: {
      label: 'Backlog',
      hint: 'Ideas, not yet committed',
      chip: '4',
      icon: 'archive',
      fill: '#f1f5f9',
      stroke: '#cbd5e1',
      headerColor: '#334155',
    },
    cards: [
      {
        id: 'CHK-250',
        summary: 'Rate-limit the coupon endpoint',
        tag: 'Backend',
        priority: 'High',
      },
      { id: 'CHK-247', summary: 'Save cart across devices', tag: 'Frontend', priority: 'Medium' },
      { id: 'CHK-245', summary: 'Empty-cart illustration', tag: 'Design', priority: 'Low' },
      { id: 'CHK-252', summary: 'Nightly price-sync job', tag: 'Infra', priority: 'Low' },
    ],
  },
  {
    lane: {
      label: 'To do',
      hint: 'Ready to pull, top first',
      chip: '3',
      icon: 'clipboard',
      fill: '#e0f2fe',
      stroke: '#7dd3fc',
      headerColor: '#0369a1',
    },
    cards: [
      {
        id: 'CHK-238',
        summary: 'Postcode lookup on the address step',
        tag: 'Frontend',
        priority: 'High',
        owner: 'LO',
      },
      {
        id: 'CHK-241',
        summary: 'Order confirmation email',
        tag: 'Backend',
        priority: 'Medium',
        owner: 'JP',
      },
      {
        id: 'CHK-244',
        summary: 'Error states for failed payment',
        tag: 'Design',
        priority: 'Medium',
        owner: 'RB',
      },
    ],
  },
  {
    lane: {
      label: 'In progress',
      hint: 'WIP limit 3: finish before you start',
      chip: '3 / 3',
      icon: 'activity',
      fill: '#fef3c7',
      stroke: '#fcd34d',
      headerColor: '#b45309',
    },
    cards: [
      {
        id: 'CHK-233',
        summary: 'Apple Pay on the payment step',
        tag: 'Frontend',
        priority: 'High',
        owner: 'AK',
        blocked: true,
      },
      {
        id: 'CHK-236',
        summary: 'Guest checkout API',
        tag: 'Backend',
        priority: 'High',
        owner: 'SM',
      },
      {
        id: 'CHK-240',
        summary: 'Basket total rounds wrong',
        tag: 'Bug',
        priority: 'Medium',
        owner: 'JP',
      },
    ],
  },
  {
    lane: {
      label: 'Review',
      hint: 'WIP limit 2: a second pair of eyes',
      chip: '1 / 2',
      icon: 'eye',
      fill: '#ede9fe',
      stroke: '#c4b5fd',
      headerColor: '#6d28d9',
    },
    cards: [
      {
        id: 'CHK-229',
        summary: 'One-page checkout layout',
        tag: 'Design',
        priority: 'Medium',
        owner: 'RB',
      },
    ],
  },
  {
    lane: {
      label: 'Done',
      hint: 'Shipped this sprint',
      chip: '4',
      icon: 'check-circle',
      fill: '#dcfce7',
      stroke: '#86efac',
      headerColor: '#15803d',
    },
    cards: [
      { id: 'CHK-220', summary: 'Saved addresses', tag: 'Frontend', owner: 'LO' },
      { id: 'CHK-214', summary: 'Stripe webhooks retry', tag: 'Backend', owner: 'SM' },
      { id: 'CHK-218', summary: 'Checkout progress bar', tag: 'Design', owner: 'RB' },
      { id: 'CHK-216', summary: 'Card form double-submit', tag: 'Bug', owner: 'AK' },
    ],
  },
];

// Tag chips bind a theme-independent style preset (docs/specs/010-palette/style-presets.md
// status and neutral tiers), so the colour that IS the tag, and a label
// readable on it, survive every theme. The concrete colours mirror the preset
// so the brand build looks exactly like the re-derived one.
const TAGS: Record<Tag, { preset: string; fill: string; stroke: string; text: string }> = {
  Frontend: { preset: 'info', fill: '#dbeafe', stroke: '#2563eb', text: '#1e3a8a' },
  Backend: { preset: 'success', fill: '#dcfce7', stroke: '#16a34a', text: '#14532d' },
  Design: { preset: 'highlight', fill: '#ede9fe', stroke: '#7c3aed', text: '#4c1d95' },
  Bug: { preset: 'danger', fill: '#fee2e2', stroke: '#dc2626', text: '#7f1d1d' },
  Infra: { preset: 'muted', fill: '#f1f5f9', stroke: '#94a3b8', text: '#475569' },
};
const PRIORITY_MARKER: Record<Priority, ShapeMarker> = {
  High: 'red-circle',
  Medium: 'orange-circle',
  Low: 'green-circle',
};
// One saturated disc per teammate, white initials on it (the group card's
// badge grammar), locked so a theme can't turn five people into one.
const PEOPLE: Record<Person, string> = {
  AK: '#7c3aed',
  SM: '#0891b2',
  LO: '#db2777',
  JP: '#ea580c',
  RB: '#16a34a',
};

export function buildKanban(cx: number, cy: number): Element[] {
  const laneW = 300;
  const gap = 20;
  const pad = 16;
  const headerH = 40;
  const hintH = 24;
  const cardW = laneW - pad * 2;
  const cardH = 104;
  const cardGap = 12;
  const titleH = 52;
  const subtitleH = 30;
  const headGap = 28;
  const cardsTop = pad + headerH + hintH + 14; // relative to the lane top
  const maxCards = Math.max(...LANES.map((l) => l.cards.length));
  const footerH = 64;
  const laneH = cardsTop + maxCards * (cardH + cardGap) + footerH + pad;
  const totalW = LANES.length * laneW + (LANES.length - 1) * gap;
  const x0 = cx - totalW / 2;
  const y0 = cy - (titleH + subtitleH + headGap + laneH) / 2;
  const top = y0 + titleH + subtitleH + headGap;

  const scaffold = { layerId: TEMPLATE_SCAFFOLD_LAYER_ID };
  const content = { layerId: TEMPLATE_CONTENT_LAYER_ID };
  const elements: Element[] = [];

  // Title + how-to on the left; the sprint goal and its progress on the right.
  const goalW = 380;
  elements.push(
    {
      ...createText(x0, y0),
      width: totalW - goalW - gap,
      height: titleH,
      label: 'Sprint 12 · Checkout revamp',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
      ...content,
    },
    {
      ...createText(x0, y0 + titleH),
      width: totalW - goalW - gap,
      height: subtitleH,
      label: 'Pull work left to right. Stay inside the WIP limits, and swarm on anything blocked.',
      textSize: 'sm',
      textColor: '#64748b',
      textAlignX: 'left',
      ...scaffold,
    },
    {
      ...createText(x0 + totalW - goalW, y0 + 4),
      width: goalW,
      height: 28,
      label: 'Goal: guest checkout live by Fri 17 Sep',
      textSize: 'sm',
      textBold: true,
      textAlignX: 'right',
      ...content,
    },
    {
      ...createShape('progress-bar', x0 + totalW - goalW, y0 + 38),
      width: goalW,
      height: 32,
      progress: 36,
      ...content,
    },
  );

  LANES.forEach(({ lane, cards }, li) => {
    const x = x0 + li * (laneW + gap);
    const chipW = lane.chip.length > 2 ? 60 : 40;
    const iconSize = 28;
    elements.push(
      {
        ...createShape('square', x, top),
        width: laneW,
        height: laneH,
        fillColor: lane.fill,
        strokeColor: lane.stroke,
        ...scaffold,
      },
      {
        ...createShape('icon', x + pad, top + pad + (headerH - iconSize) / 2),
        width: iconSize,
        height: iconSize,
        iconId: lane.icon,
        strokeColor: lane.headerColor,
        ...scaffold,
      },
      {
        ...createText(x + pad + iconSize + 10, top + pad),
        width: laneW - pad * 2 - iconSize - 10 - chipW - 8,
        height: headerH,
        label: lane.label,
        textSize: 'lg',
        textAlignX: 'left',
        textColor: lane.headerColor,
        ...scaffold,
      },
      {
        ...createShape('stadium', x + laneW - pad - chipW, top + pad + 6),
        width: chipW,
        height: headerH - 12,
        label: lane.chip,
        textSize: 'sm',
        textBold: true,
        fillColor: '#ffffff',
        strokeColor: lane.stroke,
        textColor: lane.headerColor,
        ...scaffold,
      },
      {
        ...createText(x + pad, top + pad + headerH),
        width: laneW - pad * 2,
        height: hintH,
        label: lane.hint,
        textSize: 'sm',
        textColor: '#64748b',
        textAlignX: 'left',
        ...scaffold,
      },
    );

    cards.forEach((card, ci) => {
      const cardX = x + pad;
      const cardY = top + cardsTop + ci * (cardH + cardGap);
      elements.push(...ticket(cardX, cardY, cardW, cardH, card, li === LANES.length - 1));
    });
  });

  // Done ends on a win: a trophy and the count, under the last ticket.
  const doneX = x0 + (LANES.length - 1) * (laneW + gap);
  const footerY = top + laneH - pad - footerH + 8;
  const trophy = 48;
  elements.push(
    {
      ...createShape('sticker', doneX + pad, footerY),
      width: trophy,
      height: trophy,
      stickerId: 'emoji-trophy',
      ...content,
    },
    {
      ...createText(doneX + pad + trophy + 12, footerY),
      width: cardW - trophy - 12,
      height: trophy,
      label: '4 tickets shipped',
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
      textColor: '#15803d',
      ...content,
    },
  );

  return elements;
}

// One ticket: the card, its bold-id text, the tag + priority chips along the
// bottom and the owner's initials in the corner. A Done ticket sits on a
// green-washed card, so the finished column glows a little. A blocked ticket gets a
// thick red border and a BLOCKED badge stuck over its top-right corner.
function ticket(x: number, y: number, w: number, h: number, card: Card, done: boolean): Element[] {
  const content = { layerId: TEMPLATE_CONTENT_LAYER_ID };
  const inset = 12;
  const chipH = 26;
  const chipY = y + h - inset - chipH;
  const runs: TextRun[] = [{ text: `${card.id}:`, bold: true }, { text: ` ${card.summary}` }];
  const out: Element[] = [
    {
      ...createShape('square', x, y),
      width: w,
      height: h,
      fillColor: done ? '#f0fdf4' : '#ffffff',
      strokeColor: card.blocked ? '#dc2626' : done ? '#86efac' : '#cbd5e1',
      ...(card.blocked ? { strokeWidth: 'thick' as const } : {}),
      ...content,
    },
    {
      ...createText(x + inset, y + 8),
      width: w - inset * 2 - (card.blocked ? 64 : 0),
      height: 48,
      label: runsPlainText(runs),
      richText: runs,
      textSize: 'sm',
      textAlignX: 'left',
      textAlignY: 'top',
      ...content,
    },
  ];
  const tag = TAGS[card.tag];
  const tagW = 88;
  out.push({
    ...createShape('stadium', x + inset, chipY),
    width: tagW,
    height: chipH,
    label: card.tag,
    textSize: 'sm',
    fillColor: tag.fill,
    strokeColor: tag.stroke,
    textColor: tag.text,
    strokeWidth: tag.preset === 'muted' ? 'thin' : 'medium',
    colorPreset: tag.preset,
    ...content,
  });
  if (card.priority) {
    out.push({
      ...createShape('stadium', x + inset + tagW + 8, chipY),
      width: 92,
      height: chipH,
      label: card.priority,
      textSize: 'sm',
      marker: PRIORITY_MARKER[card.priority],
      fillColor: '#ffffff',
      strokeColor: '#e2e8f0',
      textColor: '#334155',
      ...content,
    });
  }
  if (card.owner) {
    const avatar = 34;
    out.push({
      ...createShape('circle', x + w - inset - avatar, y + h - inset - avatar + 3),
      width: avatar,
      height: avatar,
      label: card.owner,
      textSize: 'sm',
      padding: 'none',
      textBold: true,
      fillColor: PEOPLE[card.owner],
      strokeColor: '#ffffff',
      textColor: '#ffffff',
      themeLockFill: true,
      ...content,
    });
  }
  if (card.blocked) {
    const badgeH = 30;
    out.push({
      ...createShape('sticker', x + w - badgeH * 2.5 + 12, y - 12),
      width: badgeH * 2.5,
      height: badgeH,
      stickerId: 'badge-blocked',
      rotation: 4,
      ...content,
    });
  }
  return out;
}
