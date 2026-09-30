// The check-in rhythm that closes the Objectives planner
// (template-builders-objectives.ts): four stops along the phase band's own
// bar, set, monthly check-ins, mid-point review and reflect, with today's
// place on it, so the sheet says how it gets used after the writing is done.
//
// Pure: returns fresh elements for the planner's scaffold and content bands.

import {
  createShape,
  createText,
  runsPlainText,
  type Element,
  type TextRun,
} from '@livediagram/document';
import { BAND_H, MUTED, chip, phaseBand } from './template-planner-parts';

export const RHYTHM_HUE = '#0d9488';

type Stop = { title: string; when: string; body: string; state: 'done' | 'now' | 'later' };

// Today is 30 Sep: set and the monthly check-ins are behind Alex, the
// mid-point review is tomorrow.
export const RHYTHM: Stop[] = [
  {
    title: 'Set',
    when: '1 Jul',
    body: 'Write three, test each against SMART, share them with Jordan.',
    state: 'done',
  },
  {
    title: 'Monthly check-ins',
    when: 'first Friday',
    body: '15 minutes: move the bars, re-rate confidence, pick the next steps.',
    state: 'done',
  },
  {
    title: 'Mid-point review',
    when: 'Thu 1 Oct',
    body: 'Keep, change or drop each one. Changing course is allowed.',
    state: 'now',
  },
  {
    title: 'Reflect',
    when: 'Fri 18 Dec',
    body: 'What moved, what I learned, and what carries into 2027.',
    state: 'later',
  },
];

const TODAY_W = 124;
const TODAY_H = 26;
const TITLE_H = 26;
const BODY_H = 44;

// The strip's height below its top edge.
export const RHYTHM_H = BAND_H + 16 + TITLE_H + 4 + BODY_H;

export function checkinRhythm(
  x: number,
  y: number,
  width: number,
): { scaffold: Element[]; content: Element[] } {
  const scaffold: Element[] = phaseBand(
    x,
    y,
    width,
    '4 · Check in: little and often beats one big review',
    RHYTHM_HUE,
  );
  const content: Element[] = [];
  const barY = y + BAND_H - 3;
  const stopW = width / RHYTHM.length;
  RHYTHM.forEach((stop, i) => {
    const mid = x + i * stopW + stopW / 2;
    const dot = stop.state === 'now' ? 24 : 18;
    const titleRuns: TextRun[] = [
      { text: stop.title, bold: true },
      { text: `  ${stop.when}`, color: MUTED },
    ];
    scaffold.push(
      {
        ...createShape('circle', mid - dot / 2, barY - dot / 2),
        width: dot,
        height: dot,
        label: '',
        fillColor: stop.state === 'later' ? '#ffffff' : RHYTHM_HUE,
        strokeColor: RHYTHM_HUE,
        strokeWidth: stop.state === 'now' ? 'thick' : 'medium',
        themeLockFill: true,
      },
      {
        ...createText(mid - stopW / 2 + 12, y + BAND_H + 16),
        width: stopW - 24,
        height: TITLE_H,
        label: runsPlainText(titleRuns),
        richText: titleRuns,
        textSize: 'sm',
        textAlignX: 'center',
      },
      {
        ...createText(mid - stopW / 2 + 24, y + BAND_H + 16 + TITLE_H + 4),
        width: stopW - 48,
        height: BODY_H,
        label: stop.body,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'center',
        textAlignY: 'top',
      },
    );
    // Where Alex is today: a chip over the stop that is up next.
    if (stop.state === 'now') {
      content.push(
        chip(mid - TODAY_W / 2, barY - 16 - TODAY_H, TODAY_W, TODAY_H, 'Today, 30 Sep', {
          fill: '#ccfbf1',
          stroke: '#5eead4',
          ink: '#115e59',
        }),
      );
    }
  });
  return { scaffold, content };
}
