// The retrospective template (docs/specs/008-canvas/canvas-and-palette.md "Templates"), split out of
// template-builders-boards.ts: it outgrew the plain "tinted column of
// stickies" shape the other boards share once it gained a mood check,
// session tools, an actions checklist and shout-outs.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[]. Built from the
// shared retro kit (template-retro-kit.ts) the other retro formats use too.

import { createShape, createSticky, createText, type Element } from '@livehuddle/document';
import {
  actionChecklist,
  actionsColumn,
  checklistHeight,
  CONTENT,
  moodCheck,
  panelHeading,
  railNote,
  RETRO,
  RETRO_HUES,
  retroHeader,
  retroHeading,
  retroNotesTop,
  retroPanel,
  SCAFFOLD,
  sessionButtons,
  stickyGrid,
  stickyGridHeight,
} from './template-retro-kit';

// A retro a team actually wants to run, laid out in the order it is run.
// A left rail opens the session: a fist-of-five temperature check ("How did
// the sprint feel?") and the two session tools the ritual needs, a 5-minute
// writing timer and a 3-dot vote, so anyone can workshop it, with the
// sprint's numbers at its foot to ground the conversation. Three tinted
// columns collect the notes (Went well / To improve / Ideas), eight to a
// column on stickies two abreast in the column's hue, written a size up so
// they read with the whole board in view. An Action items column closes it
// out as a checklist where every line carries an owner and a day, which is
// what makes a retro change anything, with last sprint's actions checked in
// underneath so promises stay visible. Columns and headers are the "Board"
// scaffold; the notes, tools and checklists ride the "Stickies" content layer
// so they stay usable when the board is locked. Shout-outs at the foot of the
// actions end it on thanks rather than on a to-do list.
const RETRO_COLUMNS = [
  {
    label: 'Went well',
    hint: 'What should we keep doing?',
    icon: 'thumbs-up',
    hue: RETRO_HUES.green,
    notes: [
      'Onboarding flow shipped on time',
      'Pairing cleared the review backlog',
      'New dashboard got great feedback',
      'Zero pages over the weekend',
      'Design and dev kicked off together',
      'Demo day had real customers',
      'Release notes written as we merged',
      'Sam’s test fixtures saved hours',
    ],
  },
  {
    label: 'To improve',
    hint: 'What slowed us down?',
    icon: 'tool',
    hue: RETRO_HUES.rose,
    notes: [
      'Flaky tests blocked two PRs',
      'Deploys still need manual approval',
      'Standup ran long most mornings',
      'Scope changed mid-sprint, twice',
      'Reviews waited a day on average',
      'Staging was down on Tuesday',
      'Too much work in progress at once',
      'Nobody owned the analytics bug',
    ],
  },
  {
    label: 'Ideas',
    hint: 'What should we try next sprint?',
    icon: 'zap',
    hue: RETRO_HUES.violet,
    notes: [
      'Try a no-meeting Wednesday',
      'Rotate a weekly flaky-test fixer',
      'Demo to a real customer each sprint',
      'Two reviews before any new ticket',
      'Swarm on the oldest ticket first',
      'Pair design and QA on edge cases',
      'Post wins in a #shipped channel',
      'Book a mid-sprint scope check',
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

// Last sprint's actions, checked in before this one's: one done, one carried.
const RETRO_LAST_ACTIONS = [
  'Fix the staging seed data · Mo · Tue',
  'Mid-sprint scope check · Jo · Thu',
];

export function buildRetrospective(cx: number, cy: number): Element[] {
  const { railW, gap, pad, titleH, subtitleH, headGap, tempH, buttonH } = RETRO;
  // Wider columns than the kit default: eight notes sit two abreast.
  const colW = 400;
  const noteH = 112;
  const colH = retroNotesTop(0) + stickyGridHeight(8, 2, noteH) + pad;
  const totalW = railW + (colW + gap) * 4;
  const x0 = cx - totalW / 2;
  const y0 = cy - (titleH + subtitleH + headGap + colH) / 2;
  const top = y0 + titleH + subtitleH + headGap;
  const notesTop = retroNotesTop(top);

  // The rail: mood check, the two session tools, a line on how to run it,
  // then the sprint in numbers at its foot.
  const buttonsY = top + tempH + 24;
  const noteY = buttonsY + buttonH + 20;
  const statH = 96;
  const statY = top + colH - statH;
  const elements: Element[] = [
    ...retroHeading(
      x0,
      y0,
      totalW,
      'Sprint 14 retro',
      'Check the temperature, write for 5 minutes, dot-vote the top three, then turn them into actions.',
    ),
    moodCheck(x0, top, railW, tempH, 'How did the sprint feel?'),
    ...sessionButtons(x0, buttonsY, railW, { minutes: 5, dots: 3 }),
    railNote(
      x0,
      noteY,
      railW,
      statY - 48 - noteY,
      'Everyone writes at once, then reads out. Three dots each.',
    ),
    // On the canvas, not a panel: the theme's ink, so it reads on a dark canvas.
    {
      ...createText(x0, statY - 40),
      width: railW,
      height: 32,
      label: 'Sprint 14 in numbers',
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
      ...SCAFFOLD,
    },
    {
      ...createShape('stat-row', x0, statY),
      width: railW,
      height: statH,
      stats: [
        { value: '34', caption: 'Points done' },
        { value: '11', caption: 'Bugs fixed' },
        { value: '6', caption: 'Releases' },
      ],
      ...CONTENT,
    },
  ];

  RETRO_COLUMNS.forEach((col, i) => {
    const x = x0 + railW + gap + i * (colW + gap);
    elements.push(
      retroPanel(x, top, colW, colH, col.hue),
      ...retroHeader(x, top, colW, col.label, col.hint, col.icon, col.hue.headerColor),
      ...stickyGrid(x + pad, notesTop, colW - pad * 2, noteH, 2, col.notes, col.hue.sticky),
    );
  });

  // The closing column: neutral paper and checklists rather than stickies,
  // so it reads as the output of the board rather than a fourth opinion.
  const actionsX = x0 + railW + gap + 3 * (colW + gap);
  const innerW = colW - pad * 2;
  elements.push(
    ...actionsColumn(actionsX, top, colH, {
      hint: 'One owner and a day each',
      items: RETRO_ACTIONS,
      width: colW,
    }),
  );
  const lastTop = notesTop + checklistHeight(RETRO_ACTIONS.length) + 20;
  elements.push(
    panelHeading(actionsX + pad, lastTop, innerW, 'From Sprint 13'),
    actionChecklist(actionsX + pad, lastTop + 40, innerW, RETRO_LAST_ACTIONS, [true, false]),
  );

  // Shout-outs close the retro on a high: thanks for someone by name, with a
  // sticker the room can pile more onto.
  const shoutTop = lastTop + 40 + checklistHeight(RETRO_LAST_ACTIONS.length) + 20;
  elements.push(panelHeading(actionsX + pad, shoutTop, innerW, 'Shout-outs'), {
    ...createSticky(actionsX + pad, shoutTop + 44),
    width: innerW,
    height: top + colH - pad - (shoutTop + 44),
    label: 'Thanks Ana for untangling the release on Thursday night!',
    textSize: 'md',
    fillColor: '#fde68a',
    textColor: '#451a03',
    ...CONTENT,
  });
  const stickerSize = 56;
  elements.push({
    ...createShape(
      'sticker',
      actionsX + colW - pad - stickerSize - 8,
      top + colH - pad - stickerSize - 8,
    ),
    width: stickerSize,
    height: stickerSize,
    stickerId: 'emoji-party-popper',
    ...CONTENT,
  });

  return elements;
}
