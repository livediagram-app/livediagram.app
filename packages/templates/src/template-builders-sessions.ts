// Live-session boards built around the Q&A board (spec/151): Lean Coffee
// and a Town Hall Q&A. Unlike the workshop boards next door these are RUN
// rather than filled in, so their centre is a live element the room writes
// into, flanked by the session tools the format calls for (a timer, a
// keep-going poll, an agenda) and a checklist for what comes out of it.
//
// The boards start EMPTY on purpose. A session template is used live, and a
// board seeded with example questions is the first thing a facilitator has to
// delete in front of the room; the board's own empty state already says what
// to do.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh
// Element[]. See spec/09 "Templates" for the catalogue.

import { createShape, createText, type Element } from '@livediagram/diagram';

const GAP = 40;
const TITLE_H = 48;
const SUBTITLE_H = 28;
const HEAD_GAP = 28;

// A checklist has no title of its own and grows no taller than its rows, so
// each one in these boards gets a heading and a hint above it, and is sized
// to what it holds rather than left as a tall empty panel.
const CHECK_ROW_H = 40;
function checklistBlock(
  x: number,
  y: number,
  width: number,
  title: string,
  hint: string,
  items: string[],
): Element[] {
  return [
    {
      ...createText(x, y),
      width,
      height: 32,
      label: title,
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(x, y + 32),
      width,
      height: 44,
      label: hint,
      textSize: 'sm',
      textColor: '#64748b',
      textAlignX: 'left',
      textAlignY: 'top',
    },
    {
      ...createShape('checklist', x, y + 84),
      width,
      height: items.length * CHECK_ROW_H + 24,
      checklistItems: items.map((text) => ({ text, done: false })),
    },
  ];
}

// The title + one-line subtitle every session board opens with.
function heading(x: number, y: number, width: number, title: string, subtitle: string): Element[] {
  return [
    { ...createText(x, y), width, height: TITLE_H, label: title, textSize: 'lg', textBold: true },
    {
      ...createText(x, y + TITLE_H),
      width,
      height: SUBTITLE_H,
      label: subtitle,
      textSize: 'sm',
      textColor: '#64748b',
    },
  ];
}

// Lean Coffee: an agenda-less meeting. Everyone proposes topics, the room
// upvotes them, and the top topic gets a short timebox; when it rings the room
// votes to keep going or move on. The Q&A board IS that loop (add, upvote,
// spotlight, Done, next), so it sits in the middle, with the timer and the
// keep-going poll beside it and a checklist for the takeaways.
export function buildLeanCoffee(cx: number, cy: number): Element[] {
  const stepsW = 300;
  const boardW = 400;
  const boardH = 620;
  const sideW = 300;
  const totalW = stepsW + boardW + sideW + GAP * 2;
  const bodyTop = TITLE_H + SUBTITLE_H + HEAD_GAP;
  const x0 = cx - totalW / 2;
  const y0 = cy - (bodyTop + boardH) / 2;
  const top = y0 + bodyTop;
  const boardX = x0 + stepsW + GAP;
  const sideX = boardX + boardW + GAP;
  const buttonW = (sideW - 20) / 2;

  return [
    ...heading(
      x0,
      y0,
      totalW,
      'Lean Coffee',
      'No agenda: the room brings the topics and votes on what to talk about.',
    ),
    {
      ...createText(x0, top),
      width: stepsW,
      height: 40,
      label: 'How it works',
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(x0, top + 48),
      width: stepsW,
      height: 300,
      label: [
        '1. Everyone adds topics to the board.',
        '2. Upvote the ones you want to talk about. The most wanted rise to the top.',
        '3. Discuss the top topic and start the 8-minute timer.',
        '4. When it rings, run the poll: keep going, or move on?',
        '5. Done, next brings up the next most-wanted topic.',
      ].join('\n\n'),
      textSize: 'sm',
      textAlignX: 'left',
      textAlignY: 'top',
    },
    { ...createShape('qa-board', boardX, top), width: boardW, height: boardH, label: 'Topics' },
    {
      ...createShape('session-button', sideX, top),
      width: buttonW,
      height: 96,
      session: { tool: 'timer', minutes: 8 },
    },
    {
      ...createShape('session-button', sideX + buttonW + 20, top),
      width: buttonW,
      height: 96,
      session: { tool: 'poll', question: 'Keep going on this topic?', style: 'yesNo' },
    },
    ...checklistBlock(
      sideX,
      top + 96 + GAP,
      sideW,
      'Takeaways and actions',
      'One line per topic, with an owner for anything that needs doing.',
      ['First takeaway', 'Action and owner'],
    ),
  ];
}

// Town Hall Q&A: an all-hands or panel where the audience asks and upvotes
// questions, often from a view-only link, which the Q&A board allows
// (spec/151). The agenda keeps the session to time, the timer runs the Q&A
// block, and anything the panel can't answer live goes on the follow-ups
// checklist with an owner.
export function buildTownHall(cx: number, cy: number): Element[] {
  const sideW = 330;
  const boardW = 440;
  const boardH = 680;
  const followW = 320;
  const totalW = sideW + boardW + followW + GAP * 2;
  const bodyTop = TITLE_H + SUBTITLE_H + HEAD_GAP;
  const x0 = cx - totalW / 2;
  const y0 = cy - (bodyTop + boardH) / 2;
  const top = y0 + bodyTop;
  const boardX = x0 + sideW + GAP;
  const followX = boardX + boardW + GAP;
  const agendaH = 300;

  return [
    ...heading(
      x0,
      y0,
      totalW,
      'Town Hall',
      'Ask anything, named or anonymous. Upvote the questions you most want answered.',
    ),
    {
      ...createShape('agenda', x0, top),
      width: sideW,
      height: agendaH,
      label: 'Agenda',
      agendaItems: [
        { label: 'Welcome', minutes: 5 },
        { label: 'Updates from the team', minutes: 15 },
        { label: 'Open Q&A', minutes: 30 },
        { label: 'Wrap-up', minutes: 5 },
      ],
    },
    // The Q&A block's timer, at the button's own width: stretched to the
    // agenda's it read as an empty bar.
    {
      ...createShape('session-button', x0, top + agendaH + GAP),
      width: 180,
      height: 96,
      session: { tool: 'timer', minutes: 30 },
    },
    {
      ...createShape('qa-board', boardX, top),
      width: boardW,
      height: boardH,
      label: 'Questions for the panel',
    },
    ...checklistBlock(
      followX,
      top,
      followW,
      'Follow-ups',
      'Anything the panel can’t answer live, with an owner and a date.',
      ['Question to follow up', 'Owner and date'],
    ),
  ];
}
