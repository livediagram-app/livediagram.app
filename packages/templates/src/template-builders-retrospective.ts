// The retrospective template (docs/specs/008-canvas/canvas-and-palette.md "Templates"), split out of
// template-builders-boards.ts: it outgrew the plain "tinted column of
// stickies" shape the other boards share once it gained a mood check,
// session tools, an actions checklist and shout-outs.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[]. Built from the
// shared retro kit (template-retro-kit.ts) the other retro formats use too.

import { createShape, createSticky, createText, type Element } from '@livediagram/document';
import {
  actionsColumn,
  checklistHeight,
  CONTENT,
  RETRO,
  RETRO_HUES,
  retroColumn,
  retroColumnHeight,
  retroHeading,
  retroNotesTop,
  retroRail,
  SCAFFOLD,
} from './template-retro-kit';

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
const RETRO_COLUMNS = [
  {
    label: 'Went well',
    hint: 'What should we keep doing?',
    icon: 'thumbs-up',
    hue: RETRO_HUES.green,
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
    hue: RETRO_HUES.rose,
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
    hue: RETRO_HUES.violet,
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
  const { colW, railW, gap, pad, titleH, subtitleH, headGap } = RETRO;
  const colH = retroColumnHeight(3);
  const totalW = railW + (colW + gap) * 4;
  const x0 = cx - totalW / 2;
  const y0 = cy - (titleH + subtitleH + headGap + colH) / 2;
  const top = y0 + titleH + subtitleH + headGap;

  const elements: Element[] = [
    ...retroHeading(
      x0,
      y0,
      totalW,
      'Sprint 14 retro',
      'Check the temperature, write for 5 minutes, dot-vote the top three, then turn them into actions.',
    ),
    // Opening rail: the room's mood first, then the two tools that run the
    // writing and voting rounds.
    ...retroRail(x0, top, colH, {
      question: 'How did the sprint feel?',
      minutes: 5,
      dots: 3,
      note: 'Everyone writes at once, then reads their notes out. Three dots each, spend them on what matters most.',
    }),
  ];

  RETRO_COLUMNS.forEach((col, i) => {
    elements.push(...retroColumn(x0 + railW + gap + i * (colW + gap), top, colH, col));
  });

  // The closing column: neutral paper and a checklist rather than stickies,
  // so it reads as the output of the board rather than a fourth opinion.
  const actionsX = x0 + railW + gap + 3 * (colW + gap);
  elements.push(
    ...actionsColumn(actionsX, top, colH, {
      hint: 'One owner and a day each',
      items: RETRO_ACTIONS,
    }),
  );
  const notesTop = retroNotesTop(top);
  const checklistH = checklistHeight(RETRO_ACTIONS.length);

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
    // Dark ink: it sits on the light Actions panel, so the theme's canvas
    // ink (white on a dark canvas) would vanish.
    textColor: '#0f172a',
    ...SCAFFOLD,
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
    ...CONTENT,
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
    ...CONTENT,
  });

  return elements;
}
