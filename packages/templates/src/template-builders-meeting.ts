// The Meeting agenda template (docs/specs/008-canvas/canvas-and-palette.md
// "Templates"): a weekly sync laid out in the order it runs.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import { createShape, createSticky, createText, type Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
import { HEAD_GAP, SUBTITLE_H, TITLE_H, heading } from './template-session-parts';
import {
  BAND_H,
  HEAD_H,
  MUTED,
  checklistHeight,
  columnHead,
  phaseBand,
} from './template-planner-parts';
import { meetingRoom } from './template-meeting-room';

// Plateful's weekly product sync, the meeting a team runs every Tuesday,
// read left to right as Before / During / After (a phase band over the
// columns says which). BEFORE sets the room: why we meet and what we leave
// with (a checklist the facilitator ticks as each outcome lands) over who is
// in it, each person with an initials disc and a role chip (facilitator,
// note-taker, timekeeper). DURING is the live agenda element, every segment
// named with its owner and timed so the minutes sum to the 45 on the invite,
// and pressing a segment starts the room's clock; the three house rules sit
// under it. The two places a meeting's output lands while it runs come next:
// a dashed Parking lot bay of amber stickies (good points, wrong meeting) and
// Decisions as decision records, one accepted with its drivers and one still
// proposed. AFTER closes the loop: actions as a checklist where every line
// has an owner and a day, then "Rate this meeting", a fist-of-five
// temperature check, so next Tuesday's sync gets better. Headings, prompts
// and the parking bay are the "Board" scaffold; everything the week fills in
// rides the "Notes" content layer.

const PHASES = [
  { label: 'Before', hint: 'set the room', hue: '#6366f1' },
  { label: 'During', hint: 'run it, park it, decide it', hue: '#0ea5e9' },
  { label: 'After', hint: 'close the loop', hue: '#8b5cf6' },
];

// Minutes sum to the 45 on the invite, so the agenda's total agrees with it.
export const MEETING_AGENDA = [
  { label: 'Check-in and wins · Maya', minutes: 5 },
  { label: 'Metrics pulse · Priya', minutes: 5 },
  { label: 'Reorder beta: go or no-go? · Sam', minutes: 15 },
  { label: 'Sprint 15 scope · Maya', minutes: 10 },
  { label: 'Parking lot triage · everyone', minutes: 5 },
  { label: 'Actions and rating · Leo', minutes: 5 },
];

const OUTCOMES = [
  'A go or no-go on reorder',
  'Sprint 15 scope agreed',
  'An owner and a day on every action',
];

const PARKED = [
  'Should reorder work for group orders? · Ana',
  'Offline menu caching needs its own session · Leo',
  'Holiday code freeze dates',
  'Rename Favourites to Saved?',
];

const ACTIONS = [
  'Flip reorder to 100% · Sam · Mon',
  'Post beta results · Priya · Wed',
  'Write the help article · Ana · Fri',
  'Book caching session · Leo · Thu',
];

export function buildMeetingAgenda(cx: number, cy: number): Element[] {
  const gap = 40;
  const beforeW = 340;
  const duringW = 380;
  const parkW = 300;
  const decideW = 340;
  const afterW = 340;
  const bodyH = 590;
  const totalW = beforeW + duringW + parkW + decideW + afterW + gap * 4;
  const x0 = cx - totalW / 2;
  const blockH = TITLE_H + SUBTITLE_H + HEAD_GAP + BAND_H + 20 + HEAD_H + 16 + bodyH;
  const y0 = cy - blockH / 2;
  const bandY = y0 + TITLE_H + SUBTITLE_H + HEAD_GAP;
  const headY = bandY + BAND_H + 20;
  const top = headY + HEAD_H + 16;
  const beforeX = x0;
  const duringX = beforeX + beforeW + gap;
  const parkX = duringX + duringW + gap;
  const decideX = parkX + parkW + gap;
  const afterX = decideX + decideW + gap;

  const scaffold: Element[] = [];
  const content: Element[] = [];

  // Title + how-to. The title is this week's meeting (content: rename it);
  // the how-to line is the board's.
  const [title, sticker, subtitle] = heading(
    x0,
    y0,
    totalW,
    'Weekly product sync · Tue 10:00 · 45 min',
    620,
    'emoji-alarm-clock',
    'Plateful product team, Room 3 and Zoom. Press a segment to start its clock; park, decide and assign as you go.',
  );
  content.push(title!, sticker!);
  scaffold.push(subtitle!);

  // The phase band: Before over the first column, During over the next
  // three, After over the last, so the running order reads at a glance.
  const phaseSpans: [number, number][] = [
    [beforeX, beforeW],
    [duringX, decideX + decideW - duringX],
    [afterX, afterW],
  ];
  PHASES.forEach((phase, i) => {
    const [x, w] = phaseSpans[i]!;
    scaffold.push(...phaseBand(x, bandY, w, `${i + 1} · ${phase.label}: ${phase.hint}`, phase.hue));
  });

  scaffold.push(
    ...columnHead(
      beforeX,
      headY,
      beforeW,
      'target',
      '#6366f1',
      'Why we meet',
      'Purpose first, then who does what',
    ),
    ...columnHead(
      duringX,
      headY,
      duringW,
      'clock',
      '#0ea5e9',
      'Run of show',
      'Press a segment to start its clock',
    ),
    ...columnHead(
      parkX,
      headY,
      parkW,
      'map-pin',
      '#d97706',
      'Parking lot',
      'Good point, wrong meeting',
    ),
    ...columnHead(
      decideX,
      headY,
      decideW,
      'check-circle',
      '#059669',
      'Decisions',
      'Record them as they land',
    ),
    ...columnHead(afterX, headY, afterW, 'flag', '#8b5cf6', 'Actions', 'One owner and a day each'),
  );

  // BEFORE: the purpose, the outcomes to tick off, and the room.
  const purposeH = 108;
  content.push({
    ...createShape('callout', beforeX, top),
    width: beforeW,
    height: purposeH,
    pageTitle: 'Purpose',
    label: 'Decide the reorder launch and lock Sprint 15, in 45 minutes.',
    iconId: 'target',
    textSize: 'sm',
    strokeColor: '#6366f1',
  });
  const subLabel = (x: number, y: number, w: number, label: string): Element => ({
    ...createText(x, y),
    width: w,
    height: 26,
    label,
    textSize: 'sm',
    textBold: true,
    textAlignX: 'left',
  });
  const outcomesY = top + purposeH + 18;
  scaffold.push(subLabel(beforeX, outcomesY, beforeW, 'We leave with'));
  content.push({
    ...createShape('checklist', beforeX, outcomesY + 32),
    width: beforeW,
    height: checklistHeight(OUTCOMES.length),
    checklistItems: OUTCOMES.map((text) => ({ text, done: false })),
  });
  const roomY = outcomesY + 32 + checklistHeight(OUTCOMES.length) + 22;
  scaffold.push(subLabel(beforeX, roomY, beforeW, 'In the room'));
  content.push(...meetingRoom(beforeX, roomY + 34, beforeW, top + bodyH - (roomY + 34)));

  // DURING: the live agenda, then the house rules under it.
  const agendaH = 356;
  content.push({
    ...createShape('agenda', duringX, top),
    width: duringW,
    height: agendaH,
    label: 'Weekly product sync',
    agendaItems: MEETING_AGENDA.map((item) => ({ ...item })),
  });
  const rulesY = top + agendaH + 24;
  scaffold.push(subLabel(duringX, rulesY, duringW, 'House rules'));
  const RULES = [
    'Start on time, even if people are missing.',
    'Off-topic goes to the parking lot, not the clock.',
    'Decide, or name who decides and by when.',
    'Roles rotate: next week Leo facilitates.',
  ];
  const ruleStep = (top + bodyH - (rulesY + 34) - 30) / (RULES.length - 1);
  RULES.forEach((rule, i) => {
    const y = rulesY + 34 + i * ruleStep;
    scaffold.push(
      {
        ...createShape('icon', duringX, y + 5),
        width: 20,
        height: 20,
        iconId: 'check',
        strokeColor: '#0ea5e9',
      },
      {
        ...createText(duringX + 30, y),
        width: duringW - 30,
        height: 30,
        label: rule,
        textSize: 'sm',
        textAlignX: 'left',
      },
    );
  });

  // The parking bay: a translucent amber wash (so it tints a light or a dark
  // canvas alike) under a dashed outline the stickies park inside.
  const bayPad = 16;
  const bay = { width: parkW, height: bodyH, label: '', borderRadius: 'lg' as const };
  scaffold.push(
    {
      ...createShape('square', parkX, top),
      ...bay,
      fillColor: '#f59e0b',
      strokeWidth: 'none',
      opacity: 0.1,
      themeLockFill: true,
    },
    {
      ...createShape('square', parkX, top),
      ...bay,
      fillColor: 'transparent',
      strokeColor: '#f59e0b',
      strokeStyle: 'dashed',
      strokeWidth: 'medium',
      themeLockFill: true,
    },
  );
  const noteH = (bodyH - bayPad * 2 - 12 * (PARKED.length - 1) - 40) / PARKED.length;
  PARKED.forEach((text, i) => {
    content.push({
      ...createSticky(parkX + bayPad, top + bayPad + i * (noteH + 12)),
      width: parkW - bayPad * 2,
      height: noteH,
      label: text,
      textSize: 'md',
      fillColor: '#fde68a',
      textColor: '#451a03',
    });
  });
  scaffold.push({
    ...createText(parkX + bayPad, top + bodyH - bayPad - 28),
    width: parkW - bayPad * 2,
    height: 28,
    label: 'Triaged in the last 5 minutes',
    textSize: 'sm',
    textColor: '#d97706',
    textBold: true,
    textAlignX: 'left',
  });

  // Decisions, as records: the one the meeting took, and one still open.
  const decisionH = 236;
  content.push(
    {
      ...createShape('decision', decideX, top),
      width: decideW,
      height: decisionH,
      label: 'Reorder goes to every user on Mon 5 Oct',
      decisionStatus: 'accepted',
      decisionDate: '2026-09-29',
      decisionDrivers: [
        'Beta: 18% of repeat orders used it',
        'No rise in support tickets',
        'Rollback is one flag',
      ],
    },
    {
      ...createShape('decision', decideX, top + decisionH + 20),
      width: decideW,
      height: decisionH,
      label: 'Move sprint demos to Thursdays',
      decisionStatus: 'proposed',
      decisionDrivers: ['Tuesdays clash with board prep', 'Needs Ana to cover support'],
    },
  );
  scaffold.push({
    ...createText(decideX, top + decisionH * 2 + 20 + 16),
    width: decideW,
    height: bodyH - decisionH * 2 - 36,
    label:
      'Proposed until the room agrees. Set the status from the card: accepted, rejected or superseded.',
    textSize: 'sm',
    textColor: MUTED,
    textAlignX: 'left',
    textAlignY: 'top',
  });

  // AFTER: the actions, then the room rates the meeting before it leaves.
  const actionsH = checklistHeight(ACTIONS.length);
  content.push({
    ...createShape('checklist', afterX, top),
    width: afterW,
    height: actionsH,
    checklistItems: ACTIONS.map((text) => ({ text, done: false })),
  });
  const tempY = top + actionsH + 24;
  const nextH = 64;
  content.push({
    ...createShape('temperature', afterX, tempY),
    width: afterW,
    height: top + bodyH - nextH - 24 - tempY,
    label: 'Rate this meeting',
  });
  // Next week's sync closes the board, so the same canvas runs again.
  content.push({
    ...createShape('callout', afterX, top + bodyH - nextH),
    width: afterW,
    height: nextH,
    pageTitle: 'Next sync · Tue 6 Oct, 10:00',
    label: 'Leo facilitates, Sam keeps time',
    iconId: 'calendar',
    textSize: 'sm',
    strokeColor: '#8b5cf6',
  });

  return [
    ...scaffold.map((el) => ({ ...el, layerId: TEMPLATE_SCAFFOLD_LAYER_ID })),
    ...content.map((el) => ({ ...el, layerId: TEMPLATE_CONTENT_LAYER_ID })),
  ];
}
