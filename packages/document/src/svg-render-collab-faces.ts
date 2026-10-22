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
import { mixHex } from './svg-render-face-kit';
import { svgTemperature } from './svg-render-temperature';
import {
  checkMark,
  collabCard,
  wrapLines,
  glow,
  PAD_X,
  PAD_Y,
  pill,
  text,
  type Face,
} from './svg-render-face-kit';

// ── Collaborate panels (docs/specs/012-collaboration/temperature-check.md, decision-record.md) ─────────────

// A decision driver's rhythm (DecisionFace): 11.5px on a snug line, 6px
// between drivers, and at most this many lines each in an export.
const DRIVER_LINES = 3;
const DRIVER_LINE = 15.8;
const DRIVER_PITCH = 21.8;

export function svgCollabFace(el: Face, label: string, color: string): string | null {
  const title = label.trim();
  switch (el.shape) {
    case 'temperature':
      return svgTemperature(el, title, color);
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
