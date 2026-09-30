// The Mad, Sad, Glad retrospective (docs/specs/008-canvas/canvas-and-palette.md "Templates"): the
// feelings-first retro, for a sprint that was hard on people rather than on
// process. Built from the shared retro kit (template-retro-kit.ts); what makes
// it its own is the rail's honesty (a "How are you, really?" mood check and an
// anonymous idea box), emoji-led columns and actions that ask what would help.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import { createShape, createText, type Element } from '@livediagram/document';
import {
  actionsColumn,
  checklistHeight,
  CONTENT,
  moodCheck,
  panelHeading,
  RETRO,
  RETRO_HUES,
  RETRO_MUTED,
  railNote,
  retroHeading,
  retroNotesTop,
  retroPanel,
  retroSticky,
  SCAFFOLD,
  sessionButtons,
  stickyGrid,
  stickyGridHeight,
  type RetroHue,
} from './template-retro-kit';

// Feelings first: each column leads with a big emoji so the mood reads
// before the words, and every note is written in the first person.
const MSG_COLUMNS: {
  label: string;
  hint: string;
  sticker: string;
  hue: RetroHue;
  notes: string[];
}[] = [
  {
    label: 'Mad',
    hint: 'What frustrated you?',
    sticker: 'emoji-angry',
    hue: RETRO_HUES.orange,
    notes: [
      'I felt blindsided by the scope change in week two',
      'I got paged at 3am three nights running',
      'I rebuilt the same endpoint twice because the spec moved',
      'I lost my focus days to meetings',
      'I gave an estimate and it became a deadline',
      'I waited four days for a design answer',
    ],
  },
  {
    label: 'Sad',
    hint: 'What let you down?',
    sticker: 'emoji-sad',
    hue: RETRO_HUES.blue,
    notes: [
      'I miss having Dana on the team',
      'I was sad we cut the accessibility fixes',
      'I felt my review comments went unanswered',
      'I never got to finish the search spike',
      'I missed the launch party because I was on call',
      'I felt nobody noticed the migration work',
    ],
  },
  {
    label: 'Glad',
    hint: 'What made you happy?',
    sticker: 'emoji-smile',
    hue: RETRO_HUES.lime,
    notes: [
      'I loved how we rallied on launch day',
      'I’m glad Marco paired with me on the migration',
      'I shipped my first feature end to end',
      'I felt heard in Tuesday’s planning',
      'I enjoyed Thursday’s call with a real customer',
      'I’m glad the flaky tests are finally gone',
    ],
  },
];

const MSG_ACTIONS = [
  'Freeze scope after planning · Nadia · Mon',
  'Weekly on-call shifts, not nightly · Raj · Wed',
  'Protect two focus days · Leo · Thu',
  'Answer reviews within a day · Team · Fri',
  'Design answers within two days · Ines · Wed',
];

// Two cards already in the box, still sealed: the room sees a count, never
// the words, until the facilitator opens it.
const MSG_ANONYMOUS = [
  'I don’t feel I can push back on deadlines',
  'Can we talk about how on-call is paid?',
];

export function buildMadSadGlad(cx: number, cy: number): Element[] {
  const { railW, gap, pad, titleH, subtitleH, headGap, buttonH, stickyGap } = RETRO;
  // Six notes two abreast in wider columns. Taller notes than the other
  // formats: the rail carries the idea box too, and a sealed box needs the
  // room to show its count.
  const colW = 400;
  const noteH = 176;
  const colH = retroNotesTop(0) + stickyGridHeight(6, 2, noteH) + pad;
  const totalW = railW + (colW + gap) * 4;
  const x0 = cx - totalW / 2;
  const y0 = cy - (titleH + subtitleH + headGap + colH) / 2;
  const top = y0 + titleH + subtitleH + headGap;
  const notesTop = retroNotesTop(top);

  // The rail opens on honesty: the mood check, then the anonymous box for
  // what nobody will say out loud, then the writing and voting tools.
  const tempH = 240;
  const boxY = top + tempH + 20;
  const buttonsY = top + colH - buttonH;
  const elements: Element[] = [
    ...retroHeading(
      x0,
      y0,
      totalW,
      'Sprint 9 · Mad, Sad, Glad',
      'Start with how people are, not how the work went. Write in the first person, vote, then ask what would help.',
    ),
    moodCheck(x0, top, railW, tempH, 'How are you, really?'),
    {
      ...createShape('idea-box', x0, boxY),
      width: railW,
      height: buttonsY - 20 - boxY,
      label: 'Say it anonymously',
      ideaCards: MSG_ANONYMOUS,
      ...CONTENT,
    },
    ...sessionButtons(x0, buttonsY, railW, { minutes: 6, dots: 3 }),
  ];

  const stickerSize = 64;
  MSG_COLUMNS.forEach((col, i) => {
    const x = x0 + railW + gap + i * (colW + gap);
    const textX = x + pad + stickerSize + 16;
    const textW = x + colW - pad - textX;
    elements.push(
      retroPanel(x, top, colW, colH, col.hue),
      {
        ...createShape('sticker', x + pad, top + pad + 4),
        width: stickerSize,
        height: stickerSize,
        stickerId: col.sticker,
        ...SCAFFOLD,
      },
      {
        ...createText(textX, top + pad),
        width: textW,
        height: 44,
        label: col.label,
        textSize: 'lg',
        textBold: true,
        textAlignX: 'left',
        textColor: col.hue.headerColor,
        ...SCAFFOLD,
      },
      {
        ...createText(textX, top + pad + 44),
        width: textW,
        height: 28,
        label: col.hint,
        textSize: 'sm',
        textColor: RETRO_MUTED,
        textAlignX: 'left',
        ...SCAFFOLD,
      },
      ...stickyGrid(
        x + pad,
        notesTop,
        colW - pad * 2,
        noteH,
        2,
        col.notes,
        col.hue.sticky,
        stickyGap,
      ),
    );
  });

  // Actions ask what would help rather than what to fix, and the next retro
  // opens by checking whether they did.
  const actionsX = x0 + railW + gap + 3 * (colW + gap);
  const innerW = colW - pad * 2;
  elements.push(
    ...actionsColumn(actionsX, top, colH, {
      label: 'What would help?',
      hint: 'One owner and a day each',
      items: MSG_ACTIONS,
      width: colW,
    }),
  );
  const checkTop = notesTop + checklistHeight(MSG_ACTIONS.length) + 12;
  elements.push(
    railNote(
      actionsX + pad,
      checkTop,
      innerW,
      44,
      'Next retro opens by asking: did each of these actually help?',
    ),
  );
  // Kind words end it on warmth: a thank-you to someone by name.
  const kindTop = checkTop + 44 + 24;
  const kindNoteTop = kindTop + 44;
  elements.push(
    panelHeading(actionsX + pad, kindTop, innerW, 'Kind words'),
    {
      ...retroSticky(
        actionsX + pad,
        kindNoteTop,
        innerW,
        top + colH - pad - kindNoteTop,
        'Thank you Dana for two brilliant years. The on-call runbook is all you.',
        { fill: '#fbcfe8', text: '#500724' },
      ),
      textSize: 'md',
    },
    {
      ...createShape('sticker', actionsX + colW - pad - 64 - 8, top + colH - pad - 64 - 8),
      width: 64,
      height: 64,
      stickerId: 'emoji-heart',
      ...CONTENT,
    },
  );
  return elements;
}
