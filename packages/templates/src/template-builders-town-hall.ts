// The Town Hall Q&A session board (docs/specs/012-collaboration/qa-board.md "Templates"), split out of
// template-builders-sessions.ts (which re-exports it); it shares that file's
// parts via template-session-parts.ts.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import { createShape, createText, type Element } from '@livediagram/document';
import {
  BUTTON_H,
  BUTTON_W,
  GAP,
  HEAD_GAP,
  MUTED,
  SECTION_H,
  SUBTITLE_H,
  TITLE_H,
  checklist,
  heading,
  note,
  section,
} from './template-session-parts';

// Town Hall Q&A: an all-hands where the audience asks and upvotes questions,
// often from a view-only link, which the Q&A board allows
// (docs/specs/012-collaboration/qa-board.md). The left column introduces the panel (who is answering,
// each with an initials disc) over an agenda naming each segment's owner, so
// pressing a segment starts the room's clock. The questions board is the
// centre. On the right, the facilitator's kit: a 30-minute timer for the open
// Q&A, an applause pad for the moments that earn it, and a 1-to-5 poll to
// close on how useful the session was; then the follow-ups the panel owes the
// room, each with an owner and a date.
const PANEL: { initials: string; name: string; role: string; colour: string }[] = [
  { initials: 'MC', name: 'Maya Chen', role: 'CEO · hosting', colour: '#7c3aed' },
  { initials: 'DP', name: 'Dev Patel', role: 'CFO · the numbers', colour: '#0891b2' },
  { initials: 'PN', name: 'Priya Nair', role: 'Head of Product · roadmap', colour: '#db2777' },
];

export function buildTownHall(cx: number, cy: number): Element[] {
  const leftW = 360;
  const boardW = 460;
  const sideW = 330;
  const panelRowH = 60;
  const panelGap = 10;
  const panelH = PANEL.length * (panelRowH + panelGap) - panelGap;
  const agendaH = 270;
  const bodyH = SECTION_H + 12 + panelH + 32 + SECTION_H + 12 + agendaH;
  const totalW = leftW + GAP + boardW + GAP + sideW;
  const x0 = cx - totalW / 2;
  const y0 = cy - (TITLE_H + SUBTITLE_H + HEAD_GAP + bodyH) / 2;
  const top = y0 + TITLE_H + SUBTITLE_H + HEAD_GAP;
  const boardX = x0 + leftW + GAP;
  const sideX = boardX + boardW + GAP;

  const elements: Element[] = [
    ...heading(
      x0,
      y0,
      totalW,
      'Q3 all-hands · Town hall',
      366,
      'emoji-microphone',
      'Ask anything, named or anonymous, from any link. Upvote the questions you most want answered.',
    ),
    section(x0, top, leftW, 'On the panel'),
  ];

  PANEL.forEach((p, i) => {
    const y = top + SECTION_H + 12 + i * (panelRowH + panelGap);
    const disc = 40;
    elements.push(
      {
        ...createShape('square', x0, y),
        width: leftW,
        height: panelRowH,
        fillColor: '#ffffff',
        strokeColor: '#cbd5e1',
      },
      {
        ...createShape('circle', x0 + 12, y + (panelRowH - disc) / 2),
        width: disc,
        height: disc,
        label: p.initials,
        textSize: 'sm',
        textBold: true,
        padding: 'none',
        fillColor: p.colour,
        strokeColor: '#ffffff',
        textColor: '#ffffff',
        themeLockFill: true,
      },
      {
        ...createText(x0 + 12 + disc + 12, y + 8),
        width: leftW - 36 - disc,
        height: 24,
        label: p.name,
        textSize: 'sm',
        textBold: true,
        textAlignX: 'left',
      },
      {
        ...createText(x0 + 12 + disc + 12, y + 30),
        width: leftW - 36 - disc,
        height: 22,
        label: p.role,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'left',
      },
    );
  });

  const agendaTop = top + SECTION_H + 12 + panelH + 32;
  elements.push(section(x0, agendaTop, leftW, 'Run of show'), {
    ...createShape('agenda', x0, agendaTop + SECTION_H + 12),
    width: leftW,
    height: agendaH,
    label: 'Agenda',
    agendaItems: [
      { label: 'Welcome · Maya', minutes: 5 },
      { label: 'The quarter in numbers · Dev', minutes: 10 },
      { label: 'What we ship next · Priya', minutes: 10 },
      { label: 'Open Q&A · everyone', minutes: 30 },
      { label: 'Wrap-up and thanks · Maya', minutes: 5 },
    ],
  });

  elements.push({
    ...createShape('qa-board', boardX, top),
    width: boardW,
    height: bodyH,
    label: 'Questions for the panel',
  });

  const kitTop = top + SECTION_H + 12;
  const padW = 150;
  elements.push(
    section(sideX, top, sideW, 'Facilitator kit'),
    {
      ...createShape('session-button', sideX, kitTop),
      width: BUTTON_W,
      height: BUTTON_H,
      session: { tool: 'timer', minutes: 30 },
    },
    {
      ...createShape('reaction-pad', sideX + sideW - padW, kitTop),
      width: padW,
      height: BUTTON_H,
      reaction: 'applause',
      label: 'Applause',
    },
    note(
      sideX,
      kitTop + BUTTON_H + 8,
      sideW,
      44,
      'Start the clock when Q&A opens. Applause is always allowed.',
    ),
    {
      ...createShape('session-button', sideX, kitTop + BUTTON_H + 64),
      width: BUTTON_W,
      height: BUTTON_H,
      session: { tool: 'poll', question: 'How useful was today?', style: 'rating' },
    },
    note(
      sideX + BUTTON_W + 16,
      kitTop + BUTTON_H + 64,
      sideW - BUTTON_W - 16,
      BUTTON_H,
      'Close on a 1 to 5 rating, while everyone is still here.',
    ),
  );
  const followY = kitTop + BUTTON_H * 2 + 64 + 36;
  elements.push(
    section(sideX, followY, sideW, 'Follow-ups'),
    note(
      sideX,
      followY + SECTION_H,
      sideW,
      44,
      'Anything the panel can’t answer live, with an owner and a date.',
    ),
    checklist(sideX, followY + SECTION_H + 52, sideW, [
      'Question to follow up',
      'Owner · answer by date',
    ]),
  );

  return elements;
}
