// Collaborate panels in the headless render (docs/specs/020-import-export/export-fidelity.md "The behaviour
// cards export as they look"): each card's structure and its marks, in its
// real colours and at its real scale, laid out in design units and scaled the
// way CollabScale does on the canvas.

import {
  DECISION_STATUS_HUES,
  DECISION_STATUS_LABELS,
  DEFAULT_DECISION_STATUS,
} from './collab-shapes';
import { r2, xmlEscape } from './svg-render-primitives';
import { svgAgenda } from './svg-render-agenda';
import { svgRollCall } from './svg-render-roll-call';
import { mixHex } from './svg-render-face-kit';
import { BODY_GAP, BODY_TOP, roundRect } from './svg-render-collab-parts';
import { svgTemperature } from './svg-render-temperature';
import { svgEstimate } from './svg-render-estimate';
import { svgIdeaBox } from './svg-render-idea-box';
import {
  checkMark,
  collabAccent,
  collabCard,
  wrapLines,
  glow,
  personDisc,
  PAD_X,
  PAD_Y,
  pill,
  text,
  type Face,
} from './svg-render-face-kit';

// ── Collaborate panels (docs/specs/012-collaboration/estimate-card.md to /129, /137) ─────────────────────────

// A decision driver's rhythm (DecisionFace): 11.5px on a snug line, 6px
// between drivers, and at most this many lines each in an export.
const DRIVER_LINES = 3;
const DRIVER_LINE = 15.8;
const DRIVER_PITCH = 21.8;

export function svgCollabFace(
  el: Face,
  label: string,
  color: string,
  // The resolved stroke: the modern cards take their accent from it
  // (collabAccent), as the canvas does.
  stroke?: string,
  // The card's resolved fill, for the accent's text form.
  fill?: string,
): string | null {
  const title = label.trim();
  const accent = collabAccent(stroke ?? color, fill ?? '#ffffff', color);
  switch (el.shape) {
    case 'estimate':
      return svgEstimate(el, title, color, accent);
    case 'temperature':
      return svgTemperature(el, title, color);
    case 'idea-box':
      return svgIdeaBox(el, title, color, accent);
    case 'agenda':
      return svgAgenda(el, title, color, accent);
    case 'decision': {
      // The card as the face draws it (docs/specs/012-collaboration/decision-record.md "The face"): the status
      // as a badge with its glyph in the status hue, a soft glow of it from the
      // top corner, the drivers under "Because" with arrow markers, the date.
      const status = el.decisionStatus ?? DEFAULT_DECISION_STATUS;
      const hue = DECISION_STATUS_HUES[status];
      const drivers = el.decisionDrivers ?? [];
      const labelText = DECISION_STATUS_LABELS[status];
      // The frame draws no title here: the statement wraps to three lines in
      // the room left of the badge, at the size the canvas sets it (15px).
      return collabCard(el, '', undefined, color, (w, h) => {
        const badgeW = labelText.length * 6 + 30;
        const bx = w - PAD_X - badgeW;
        const by = PAD_Y + 1;
        const badge =
          pill(bx, by, badgeW, 18, hue, 0.16) +
          statusGlyph(status, bx + 11, by + 9, hue) +
          text(bx + 20, by + 12.5, labelText, { size: 10, weight: 600, color: hue });
        const statement = wrapLines(title || 'We will …', w - PAD_X * 2 - badgeW - 8, 15, 3);
        // The canvas's rhythm (DecisionFace): the statement at 15px on a
        // 20.6px line, then "Because" and the drivers on a 21.8px pitch.
        const heading = statement
          .map((line, i) =>
            text(PAD_X, PAD_Y + 15 + i * 20.6, line, { size: 15, weight: 600, color }),
          )
          .join('');
        const headerBottom = PAD_Y + Math.max(24, statement.length * 20.6);
        const ink = mixHex(hue, color, 0.7);
        const head =
          heading +
          text(PAD_X, headerBottom + 20, 'BECAUSE', {
            size: 9.5,
            weight: 700,
            color: ink,
            opacity: 0.85,
          });
        const listTop = headerBottom + 29;
        const dateW = (el.decisionDate?.length ?? 0) * 6 + 32;
        const dateY = h - PAD_Y - 20;
        // Each driver wraps (up to DRIVER_LINES) as the canvas's list does;
        // the ones that do not fit above the date are counted in a "+N more"
        // line rather than dropped without a word.
        const listEnd = (el.decisionDate ? dateY : h - PAD_Y) - 6;
        let body = '';
        let y = listTop;
        let shown = 0;
        for (const d of drivers) {
          const lines = wrapLines(d, w - PAD_X * 2 - 22, 11.5, DRIVER_LINES);
          const itemH = DRIVER_PITCH + (lines.length - 1) * DRIVER_LINE;
          const reserve = shown + 1 < drivers.length ? DRIVER_PITCH : 0;
          if (y + itemH + reserve > listEnd) break;
          body +=
            `<circle cx="${r2(PAD_X + 7)}" cy="${r2(y + 10)}" r="7" fill="${xmlEscape(hue)}" fill-opacity="0.16"/>` +
            text(PAD_X + 7, y + 13, '→', { size: 9, weight: 700, color: ink, anchor: 'middle' }) +
            lines
              .map((line, i) =>
                text(PAD_X + 22, y + 12 + i * DRIVER_LINE, line, {
                  size: 11.5,
                  color,
                  opacity: 0.85,
                }),
              )
              .join('');
          y += itemH;
          shown += 1;
        }
        if (shown < drivers.length) {
          body += text(PAD_X + 22, y + 12, `+${drivers.length - shown} more`, {
            size: 11,
            weight: 600,
            color,
            opacity: 0.55,
          });
        }
        if (drivers.length === 0) {
          body = text(PAD_X, listTop + 12, '+ Add what drove this from the element’s menu.', {
            size: 11,
            color,
            opacity: 0.5,
          });
        }
        const date = el.decisionDate
          ? pill(PAD_X, dateY, dateW, 20, color, 0.07) +
            `<g transform="translate(${r2(PAD_X + 7)} ${r2(dateY + 4.5)}) scale(0.69)" fill="none" stroke="${xmlEscape(color)}" stroke-width="2.2" stroke-linecap="round"><rect x="2.5" y="3.5" width="11" height="10" rx="2"/><path d="M2.5 6.8h11M5.5 2v3M10.5 2v3"/></g>` +
            text(PAD_X + 22, dateY + 14, el.decisionDate, { size: 10.5, weight: 500, color })
          : '';
        return (
          glow(`decision-${el.id}`, 0, 0, w, h, hue, { cx: 0, cy: 0 }, 0.16, 10) +
          badge +
          head +
          body +
          date
        );
      });
    }
    case 'roll-call':
      return svgRollCall(el, title, color, accent, fill ?? '#ffffff');
    case 'done-check': {
      // The card as the face draws it (docs/specs/012-collaboration/done-check.md "Reading the card"): the ring
      // at the share of marks it holds, the count in it, and the button. An
      // export has no room to count against, so the ring reads the marks as
      // the whole: done when there are any, drawn at full.
      const done = (el.responses ?? []).length;
      return collabCard(
        el,
        title || 'Everyone done?',
        // done/total, as the canvas reads it; with no room to count against,
        // the marks are the whole.
        done ? `${done}/${done}` : undefined,
        color,
        (w, h) => {
          // The canvas's 84px ring (7px stroke), centred in the room above the
          // button.
          const r = 38.5;
          const btnH = 34;
          const btnY = h - PAD_Y - btnH;
          const cx = PAD_X + r + 3.5;
          const cy = (BODY_TOP + btnY - BODY_GAP) / 2;
          const circ = 2 * Math.PI * r;
          const arc = done
            ? `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r}" fill="none" stroke="#22c55e" stroke-width="7" stroke-linecap="round" stroke-dasharray="${r2(circ)}" stroke-dashoffset="0" transform="rotate(-90 ${r2(cx)} ${r2(cy)})"/>`
            : '';
          return (
            `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r}" fill="none" stroke="${xmlEscape(color)}" stroke-opacity="0.12" stroke-width="7"/>` +
            arc +
            (done
              ? checkMark(cx, cy, 30, '#22c55e', 2.6)
              : text(cx, cy + 6, '0', { size: 18, weight: 700, color, anchor: 'middle' })) +
            // Who is done, as the roster: an export has no names for them (a
            // done check stores an opaque key per mark), so neutral discs,
            // each wearing the green check.
            (done
              ? text(cx + r + 18, cy - 14, 'DONE', { size: 9, weight: 700, color, opacity: 0.6 }) +
                Array.from({ length: Math.min(done, 6) }, (_, i) => {
                  const px = cx + r + 30 + i * 26;
                  return (
                    personDisc(px, cy + 6, 10, color) +
                    `<circle cx="${r2(px + 8)}" cy="${r2(cy + 14)}" r="5" fill="#22c55e"/>` +
                    checkMark(px + 8, cy + 14, 7, '#ffffff', 1.6)
                  );
                }).join('') +
                (done > 6
                  ? text(cx + r + 30 + 6 * 26, cy + 10, `+${done - 6}`, {
                      size: 10,
                      weight: 700,
                      color,
                      opacity: 0.6,
                    })
                  : '')
              : text(cx + r + 18, cy + 4, 'Nobody done yet', { size: 11, weight: 600, color })) +
            // The one act, loud in the accent (DoneButton, before you are done).
            roundRect(PAD_X, btnY, w - PAD_X * 2, btnH, 12, accent.accent, 1) +
            checkMark(w / 2 - 34, btnY + btnH / 2, 13, accent.on, 1.8) +
            text(w / 2 + 6, btnY + 21.5, "I'm done", {
              size: 12,
              weight: 600,
              color: accent.on,
              anchor: 'middle',
            })
          );
        },
      );
    }
    default:
      return null;
  }
}


/** The Decision record status glyph (as its badge draws it), centred at (cx, cy). */
function statusGlyph(status: string, cx: number, cy: number, hue: string): string {
  const k = `stroke="${xmlEscape(hue)}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  if (status === 'accepted') return checkMark(cx, cy, 11, hue, 1.6);
  if (status === 'rejected')
    return `<path d="M ${r2(cx - 3)} ${r2(cy - 3)} L ${r2(cx + 3)} ${r2(cy + 3)} M ${r2(cx + 3)} ${r2(cy - 3)} L ${r2(cx - 3)} ${r2(cy + 3)}" ${k}/>`;
  if (status === 'superseded')
    return `<path d="M ${r2(cx - 3.5)} ${r2(cy + 2)} a 3.5 3.5 0 0 1 6 -2.5 M ${r2(cx + 3)} ${r2(cy - 3.5)} v 2.5 h -2.5" ${k}/>`;
  return `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="3.2" ${k} stroke-dasharray="1.6 1.6"/>`;
}
