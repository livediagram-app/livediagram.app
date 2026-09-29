// The retrospective template (docs/specs/008-canvas/canvas-and-palette.md "Templates"), split out of
// template-builders-boards.ts: it outgrew the plain "tinted column of
// stickies" shape the other boards share once it gained a mood check,
// session tools, an actions checklist and shout-outs.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import { createShape, createSticky, createText, type Element } from '@livediagram/diagram';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

// A retro a team actually wants to run, laid out in the order it is run.
// A left rail opens the session: a fist-of-five temperature check ("How did
// the sprint feel?") and the two session tools the ritual needs, a 5-minute
// writing timer and a 3-dot vote, so anyone can facilitate it. Three tinted
// columns collect the notes (Went well / To improve / Ideas), each note on a
// sticky in its column's hue, and an Action items column closes it out as a
// checklist where every line carries an owner and a day, which is what makes
// a retro change anything. Columns and headers are the "Board" scaffold; the
// notes, tools and checklist ride the "Stickies" content layer so they stay
// usable when the board is locked. Shout-outs under the actions end it on
// thanks rather than on a to-do list.
type RetroColumn = {
  label: string;
  hint: string;
  icon: string;
  fill: string;
  stroke: string;
  headerColor: string;
  sticky: { fill: string; text: string };
  notes: [string, string, string];
};

const RETRO_COLUMNS: RetroColumn[] = [
  {
    label: 'Went well',
    hint: 'What should we keep doing?',
    icon: 'thumbs-up',
    fill: '#dcfce7',
    stroke: '#86efac',
    headerColor: '#15803d',
    sticky: { fill: '#bbf7d0', text: '#052e16' },
    notes: [
      'Onboarding flow shipped on time',
      'Pairing cleared the review backlog',
      'New dashboard got great user feedback',
    ],
  },
  {
    label: 'To improve',
    hint: 'What slowed us down?',
    icon: 'tool',
    fill: '#ffe4e6',
    stroke: '#fda4af',
    headerColor: '#be123c',
    sticky: { fill: '#fecdd3', text: '#4c0519' },
    notes: [
      'Flaky tests blocked two PRs',
      'Deploys still need a manual approval',
      'Standup ran long most mornings',
    ],
  },
  {
    label: 'Ideas',
    hint: 'What should we try next sprint?',
    icon: 'zap',
    fill: '#ede9fe',
    stroke: '#c4b5fd',
    headerColor: '#6d28d9',
    sticky: { fill: '#e9d5ff', text: '#3b0764' },
    notes: [
      'Try a no-meeting Wednesday',
      'Rotate a weekly flaky-test fixer',
      'Demo to a real customer each sprint',
    ],
  },
];

// Each action names what, who and by when, so the checklist doubles as the
// follow-up list for the next retro.
const RETRO_ACTIONS = [
  'Automate deploy approval · Sam · Fri',
  'Quarantine flaky tests · Ana · Wed',
  'Timebox standup to 15 min · Leo · Mon',
];

export function buildRetrospective(cx: number, cy: number): Element[] {
  const colW = 360;
  const railW = 320;
  const gap = 32;
  const pad = 20;
  const headerH = 48;
  const hintH = 28;
  const stickyH = 116;
  const stickyGap = 16;
  const iconSize = 40;
  const titleH = 52;
  const subtitleH = 30;
  const headGap = 28;
  const colH = pad + headerH + hintH + stickyGap + 3 * stickyH + 2 * stickyGap + pad;
  const totalW = railW + (colW + gap) * 4;
  const x0 = cx - totalW / 2;
  const y0 = cy - (titleH + subtitleH + headGap + colH) / 2;
  const top = y0 + titleH + subtitleH + headGap;

  const scaffold = { layerId: TEMPLATE_SCAFFOLD_LAYER_ID };
  const content = { layerId: TEMPLATE_CONTENT_LAYER_ID };
  const elements: Element[] = [
    {
      ...createText(x0, y0),
      width: totalW,
      height: titleH,
      label: 'Sprint 14 retro',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
      ...content,
    },
    {
      ...createText(x0, y0 + titleH),
      width: totalW,
      height: subtitleH,
      label:
        'Check the temperature, write for 5 minutes, dot-vote the top three, then turn them into actions.',
      textSize: 'sm',
      textColor: '#64748b',
      textAlignX: 'left',
      ...scaffold,
    },
  ];

  // Opening rail: the room's mood first, then the two tools that run the
  // writing and voting rounds.
  const tempH = 300;
  elements.push({
    ...createShape('temperature', x0, top),
    width: railW,
    height: tempH,
    label: 'How did the sprint feel?',
    ...content,
  });
  const buttonW = (railW - 16) / 2;
  const buttonY = top + tempH + 24;
  elements.push(
    {
      ...createShape('session-button', x0, buttonY),
      width: buttonW,
      height: 96,
      session: { tool: 'timer', minutes: 5 },
      ...content,
    },
    {
      ...createShape('session-button', x0 + buttonW + 16, buttonY),
      width: buttonW,
      height: 96,
      session: { tool: 'vote', dots: 3 },
      ...content,
    },
  );
  elements.push({
    ...createText(x0, buttonY + 96 + 20),
    width: railW,
    height: colH - (buttonY + 96 + 20 - top),
    label:
      'Everyone writes at once, then reads their notes out. Three dots each, spend them on what matters most.',
    textSize: 'sm',
    textColor: '#64748b',
    textAlignX: 'left',
    textAlignY: 'top',
    ...scaffold,
  });

  const columnHeader = (x: number, label: string, hint: string, icon: string, color: string) => {
    elements.push(
      {
        ...createText(x + pad, top + pad),
        width: colW - pad * 2 - iconSize,
        height: headerH,
        label,
        textSize: 'lg',
        textAlignX: 'left',
        textColor: color,
        ...scaffold,
      },
      {
        ...createShape('icon', x + colW - pad - iconSize, top + pad + (headerH - iconSize) / 2),
        width: iconSize,
        height: iconSize,
        iconId: icon,
        strokeColor: color,
        ...scaffold,
      },
      {
        ...createText(x + pad, top + pad + headerH),
        width: colW - pad * 2,
        height: hintH,
        label: hint,
        textSize: 'sm',
        textColor: '#64748b',
        textAlignX: 'left',
        ...scaffold,
      },
    );
  };

  const notesTop = top + pad + headerH + hintH + stickyGap;
  RETRO_COLUMNS.forEach((col, i) => {
    const x = x0 + railW + gap + i * (colW + gap);
    elements.push({
      ...createShape('square', x, top),
      width: colW,
      height: colH,
      fillColor: col.fill,
      strokeColor: col.stroke,
      ...scaffold,
    });
    columnHeader(x, col.label, col.hint, col.icon, col.headerColor);
    col.notes.forEach((note, j) => {
      elements.push({
        ...createSticky(x + pad, notesTop + j * (stickyH + stickyGap)),
        width: colW - pad * 2,
        height: stickyH,
        label: note,
        textSize: 'sm',
        fillColor: col.sticky.fill,
        textColor: col.sticky.text,
        ...content,
      });
    });
  });

  // The closing column: neutral paper and a checklist rather than stickies,
  // so it reads as the output of the board rather than a fourth opinion.
  const actionsX = x0 + railW + gap + 3 * (colW + gap);
  elements.push({
    ...createShape('square', actionsX, top),
    width: colW,
    height: colH,
    fillColor: '#f8fafc',
    strokeColor: '#94a3b8',
    strokeWidth: 'thick',
    ...scaffold,
  });
  columnHeader(actionsX, 'Action items', 'One owner and a day each', 'check-circle', '#0f172a');
  const checklistH = RETRO_ACTIONS.length * 40 + 24;
  elements.push({
    ...createShape('checklist', actionsX + pad, notesTop),
    width: colW - pad * 2,
    height: checklistH,
    checklistItems: RETRO_ACTIONS.map((text) => ({ text, done: false })),
    ...content,
  });

  // Shout-outs close the retro on a high: thanks for someone by name, with a
  // sticker the room can pile more onto.
  const shoutTop = notesTop + checklistH + 28;
  elements.push({
    ...createText(actionsX + pad, shoutTop),
    width: colW - pad * 2,
    height: 36,
    label: 'Shout-outs',
    textSize: 'md',
    textBold: true,
    textAlignX: 'left',
    ...scaffold,
  });
  const shoutH = top + colH - pad - (shoutTop + 44);
  elements.push({
    ...createSticky(actionsX + pad, shoutTop + 44),
    width: colW - pad * 2,
    height: shoutH,
    label: 'Thanks Ana for untangling the release on Thursday night!',
    textSize: 'sm',
    fillColor: '#fde68a',
    textColor: '#451a03',
    ...content,
  });
  const stickerSize = 64;
  elements.push({
    ...createShape(
      'sticker',
      actionsX + colW - pad - stickerSize - 8,
      top + colH - pad - stickerSize - 8,
    ),
    width: stickerSize,
    height: stickerSize,
    stickerId: 'emoji-party-popper',
    ...content,
  });

  return elements;
}
