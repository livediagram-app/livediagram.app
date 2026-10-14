// The Agenda in the headless render (docs/specs/012-collaboration/agenda.md "The face"), drawn as the
// canvas's AgendaFace + AgendaStep draw it: the header's run time, a progress
// bar of the session so far, and the stepper. Done steps carry a tinted check
// and a struck name; the current one is an accent-lit row with its minutes
// large and a drain bar; the rest a hollow ring. Geometry is the canvas's, in
// the card's design units (CollabPanel's 16/14 padding, 32.5px steps).

import { agendaTotalMinutes, clampAgendaMinutes, type AgendaItem } from './collab-shapes';
import { SHAPE_DEFAULT_SIZE } from './shape-factory';
import { r2, xmlEscape } from './svg-render-primitives';
import {
  checkMark,
  collabCard,
  PAD_X,
  PAD_Y,
  text,
  TITLE_PX,
  wrapLines,
  type CollabAccent,
  type Face,
} from './svg-render-face-kit';

// A wrapped agenda name's second line, below its first.
const NAME_LINE_PX = 14;
const STEP_H = 32.5;
// The current step's extra: the drain bar and its margin.
const CURRENT_EXTRA = 10.5;

// Under the header row, which on the canvas is as tall as its 24px settings button rather than the
// title alone; the first step sits under the progress bar.
const BAR_Y = PAD_Y + TITLE_PX + 14;
const FIRST_STEP_Y = BAR_Y + 14;
// The room a fitted card leaves below its last step: the card's own padding.
const LAST_ROW_SLACK = PAD_Y;

type StepState = 'done' | 'current' | 'ahead';

// One step's state, its wrapped name and its row height, in a card `w` design units wide.
function stepOf(item: AgendaItem, i: number, current: number | undefined, w: number) {
  const state: StepState =
    current === undefined ? 'ahead' : i === current ? 'current' : i < current ? 'done' : 'ahead';
  // A name wraps (two lines, as the canvas wraps it, the second ending in an ellipsis only when it
  // runs on), and its row grows by the line.
  const names = wrapLines(item.label || `Segment ${i + 1}`, w - PAD_X * 2 - 46 - 40, 12, 2);
  const extra = (names.length - 1) * NAME_LINE_PX;
  const rowH = (state === 'current' ? STEP_H + CURRENT_EXTRA : STEP_H) + extra;
  return { state, names, extra, rowH };
}

// The height an agenda needs to draw every one of its segments at its width (docs/specs/012-collaboration/agenda.md
// "The face"), never less than it has: the card scales with its width, so the steps' design height
// is scaled by it. An agenda with no segments keeps its height.
export function agendaFitHeight(el: {
  width: number;
  height: number;
  agendaItems?: readonly AgendaItem[];
  agendaCurrent?: number;
}): number {
  const items = el.agendaItems ?? [];
  if (items.length === 0) return el.height;
  const design = SHAPE_DEFAULT_SIZE.agenda!;
  const steps = items.reduce(
    (sum, item, i) => sum + stepOf(item, i, el.agendaCurrent, design.width).rowH,
    0,
  );
  const needed = Math.ceil(((FIRST_STEP_Y + steps + LAST_ROW_SLACK) * el.width) / design.width);
  return Math.max(el.height, needed);
}

// "1h 5m" / "45m", the canvas's formatMinutes.
function formatMinutes(total: number): string {
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

const rect = (x: number, y: number, w: number, h: number, rx: number, fill: string, op: number) =>
  `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(Math.max(0, w))}" height="${r2(h)}" rx="${r2(rx)}" fill="${xmlEscape(fill)}" fill-opacity="${op}"/>`;

export function svgAgenda(el: Face, title: string, color: string, a: CollabAccent): string {
  const items = el.agendaItems ?? [];
  const total = agendaTotalMinutes(items);
  const current = el.agendaCurrent;
  return collabCard(
    el,
    title || 'Agenda',
    items.length ? formatMinutes(total) : undefined,
    color,
    (w, h) => {
      if (items.length === 0) {
        return (
          text(w / 2, h / 2 - 4, 'No segments yet', {
            size: 12.5,
            weight: 600,
            color,
            anchor: 'middle',
          }) +
          text(w / 2, h / 2 + 14, 'Add them from the element’s menu, under Segments.', {
            size: 11,
            color,
            anchor: 'middle',
            opacity: 0.55,
          })
        );
      }
      // The session so far: finished segments' minutes over the total (a
      // still image has no running clock, so the current one counts as begun).
      let elapsed = 0;
      if (current !== undefined) {
        items.forEach((item, i) => {
          if (i < current) elapsed += clampAgendaMinutes(item.minutes);
        });
      }
      const share = total > 0 ? Math.min(1, elapsed / total) : 0;
      // Under the header row, which on the canvas is as tall as its 24px
      // settings button rather than the title alone.
      const barY = BAR_Y;
      const barW = w - PAD_X * 2;
      let out =
        rect(PAD_X, barY, barW, 4, 2, color, 0.08) +
        (share > 0 ? rect(PAD_X, barY, barW * share, 4, 2, a.accent, 1) : '');

      const markerX = PAD_X + 8;
      const nameX = PAD_X + 36;
      const rightX = w - PAD_X - 10;
      let y = FIRST_STEP_Y;
      items.forEach((item, i) => {
        const { state, names, extra, rowH } = stepOf(item, i, current, w);
        if (y + rowH - 4 > h - PAD_Y + 4) return;
        const minutes = clampAgendaMinutes(item.minutes);
        const cy = y + 16;
        // The rail down to the next step.
        if (i < items.length - 1) {
          out += `<line x1="${r2(markerX)}" y1="${r2(y + 20)}" x2="${r2(markerX)}" y2="${r2(y + rowH + 6)}" stroke="${xmlEscape(state === 'done' ? a.accent : color)}" stroke-opacity="${state === 'done' ? 0.45 : 0.1}" stroke-width="2" stroke-linecap="round"/>`;
        }
        if (state === 'current') {
          out += `<rect x="${r2(PAD_X + 26.5)}" y="${r2(y + 0.5)}" width="${r2(w - PAD_X * 2 - 27)}" height="${r2(rowH - 5)}" rx="12" fill="${xmlEscape(a.accent)}" fill-opacity="0.12" stroke="${xmlEscape(a.accent)}" stroke-opacity="0.35"/>`;
        }
        // The marker.
        if (state === 'done') {
          out +=
            `<circle cx="${r2(markerX)}" cy="${r2(cy)}" r="8" fill="${xmlEscape(a.accent)}" fill-opacity="0.2"/>` +
            checkMark(markerX, cy, 9, a.ink, 1.6);
        } else if (state === 'current') {
          out +=
            `<circle cx="${r2(markerX)}" cy="${r2(cy)}" r="8" fill="${xmlEscape(a.accent)}"/>` +
            `<circle cx="${r2(markerX)}" cy="${r2(cy)}" r="3" fill="${xmlEscape(a.on)}"/>`;
        } else {
          out += `<circle cx="${r2(markerX)}" cy="${r2(cy)}" r="7" fill="none" stroke="${xmlEscape(color)}" stroke-opacity="0.22" stroke-width="2"/>`;
        }
        const base = y + 18.5;
        names.forEach((name, n) => {
          out += text(nameX, base + n * NAME_LINE_PX, name, {
            size: 12,
            weight: state === 'current' ? 600 : 500,
            color,
            opacity: state === 'done' ? 0.45 : undefined,
            strike: state === 'done',
          });
        });
        out +=
          state === 'current'
            ? text(rightX, base, `${minutes}m`, {
                size: 15,
                weight: 700,
                color: a.ink,
                anchor: 'end',
              })
            : text(rightX, base, `${minutes}m`, {
                size: 10.5,
                color,
                anchor: 'end',
                opacity: state === 'done' ? 0.35 : 0.55,
              });
        if (state === 'current') {
          const dy = y + 28.5 + extra;
          out +=
            rect(nameX, dy, rightX - nameX, 4, 2, a.accent, 0.18) +
            rect(nameX, dy, rightX - nameX, 4, 2, a.accent, 1);
        }
        y += rowH;
      });
      return out;
    },
  );
}
