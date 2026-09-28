// The Comment and Action panels in the headless render (docs/specs/012-collaboration/comment-pin.md "The
// look", docs/specs/012-collaboration/action-panel.md "The card"), drawn the way the canvas faces now look:
// the comment thread as bubbles under their authors, the action as its name
// with a status chip, the assignee row and the Mark Complete footer. Motion,
// hover and the composer's live states are left out, as for every face in a
// still image (docs/specs/020-import-export/export-fidelity.md).
//
// `accent` is the element's stroke, which IS the tab theme's accent: the same
// source the canvas's CollabAccentScope reads.

import { canvasSurface } from './colors';
import { initialsOf } from './names';
import { r2, xmlEscape } from './svg-render-primitives';
import {
  checkMark,
  collabCard,
  PAD_X,
  PAD_Y,
  personDisc,
  pill,
  text,
  TITLE_PX,
  wrapLines,
  type Face,
} from './svg-render-face-kit';

// Completion's colour, the canvas card's ACTION_DONE and the Done check's green.
const DONE = '#16a34a';

// The ink that reads ON the accent: CollabAccentScope's rule.
const onAccent = (accent: string): string =>
  canvasSurface(accent) === 'dark' ? '#ffffff' : '#0f172a';

// The canvas glyphs' own 16-unit paths (collab/qa/qa-parts, action-parts),
// dropped in at size: a mark redrawn by hand in a second renderer drifts.
const BUBBLE_D =
  'M3 2.8h10a1.2 1.2 0 0 1 1.2 1.2v6.2a1.2 1.2 0 0 1-1.2 1.2H7.4L4.2 14v-2.6H3a1.2 1.2 0 0 1-1.2-1.2V4A1.2 1.2 0 0 1 3 2.8Z';
const CLIPBOARD_D =
  'M5.5 2.8h5M5.5 2.8a1 1 0 0 0-1 1v.2h7v-.2a1 1 0 0 0-1-1M4.5 3.4H3.6a1 1 0 0 0-1 1v8.6a1 1 0 0 0 1 1h8.8a1 1 0 0 0 1-1V4.4a1 1 0 0 0-1-1h-.9M5.6 9.2l1.7 1.7 3.2-3.6';
const PENCIL_D = 'M10.6 3.1 12.9 5.4 6 12.3l-3 .7.7-3 6.9-6.9ZM9.4 4.3l2.3 2.3';

const glyph = (cx: number, cy: number, size: number, color: string, d: string): string => {
  const k = size / 16;
  return `<path d="${d}" transform="translate(${r2(cx - size / 2)} ${r2(cy - size / 2)}) scale(${r2(k)})" fill="none" stroke="${xmlEscape(color)}" stroke-width="${r2(1.5 / k)}" stroke-linecap="round" stroke-linejoin="round"/>`;
};

const roundRect = (
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
  fill: string,
  opacity: number,
): string =>
  `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="${r2(rx)}" fill="${xmlEscape(fill)}" fill-opacity="${opacity}"/>`;

export function svgCommentPanel(el: Face, title: string, color: string, accent: string): string {
  const thread = el.commentThread;
  const comments = thread?.comments ?? [];
  const resolved = thread?.resolved === true;
  // The header's slot holds Resolve on the canvas, a control a still image
  // cannot press, so the export shows it only once it has been used.
  const aside = resolved ? 'Resolved' : undefined;
  return collabCard(el, title || 'Comments', aside, color, (w, h) => {
    const composerH = 28;
    const composerY = h - PAD_Y - composerH;
    const composer = resolved
      ? ''
      : pill(PAD_X, composerY, w - PAD_X * 2, composerH, color, 0.05) +
        text(PAD_X + 10, composerY + 17.5, comments.length ? 'Reply…' : 'Write a comment…', {
          size: 10,
          color,
          opacity: 0.45,
        }) +
        `<circle cx="${r2(w - PAD_X - 14)}" cy="${r2(composerY + composerH / 2)}" r="10" fill="${xmlEscape(accent)}" opacity="0.9"/>`;
    const top = PAD_Y + TITLE_PX + 16;
    if (comments.length === 0) {
      const cy = (top + composerY) / 2;
      return (
        `<circle cx="${r2(w / 2)}" cy="${r2(cy - 16)}" r="14" fill="${xmlEscape(accent)}" fill-opacity="0.14"/>` +
        glyph(w / 2, cy - 16, 14, accent, BUBBLE_D) +
        text(w / 2, cy + 12, 'Start the Conversation', {
          size: 12,
          weight: 600,
          color,
          anchor: 'middle',
        }) +
        composer
      );
    }
    // Newest last, as the card keeps the newest in view: fill from the
    // bottom of the space above the composer and drop what does not fit.
    const bottom = (resolved ? h - PAD_Y : composerY) - 8;
    const bubbleW = w - PAD_X * 2 - 26;
    const blocks = comments.map((c) => {
      const lines = wrapLines(c.text, bubbleW - 16, 11, 3);
      return { c, lines, h: 14 + lines.length * 14 + 12 };
    });
    let y = bottom;
    const shown: typeof blocks = [];
    for (let i = blocks.length - 1; i >= 0; i--) {
      if (y - blocks[i]!.h < top) break;
      y -= blocks[i]!.h;
      shown.unshift(blocks[i]!);
    }
    let at = y;
    const body = shown
      .map(({ c, lines, h: bh }) => {
        const disc = personDisc(PAD_X + 10, at + 10, 10, color, {
          initials: c.authorName.trim().charAt(0).toUpperCase() || '?',
          fill: c.authorColor,
        });
        const name = text(PAD_X + 26, at + 11, c.authorName, { size: 10, weight: 600, color });
        const bubbleH = lines.length * 14 + 8;
        const bubble =
          roundRect(PAD_X + 26, at + 16, bubbleW, bubbleH, 10, color, 0.06) +
          lines
            .map((line, i) => text(PAD_X + 34, at + 29 + i * 14, line, { size: 11, color }))
            .join('');
        at += bh;
        return disc + name + bubble;
      })
      .join('');
    return `<g opacity="${resolved ? 0.55 : 1}">${body}</g>` + composer;
  });
}

export function svgActionPanel(el: Face, color: string, accent: string): string {
  const action = el.action;
  if (!action) {
    return collabCard(el, 'Action', undefined, color, (w, h) => {
      const cy = h / 2 + 4;
      return (
        `<circle cx="${r2(w / 2)}" cy="${r2(cy - 24)}" r="14" fill="${xmlEscape(accent)}" fill-opacity="0.14"/>` +
        glyph(w / 2, cy - 24, 14, accent, CLIPBOARD_D) +
        text(w / 2, cy + 4, 'No Action Yet', { size: 12, weight: 600, color, anchor: 'middle' }) +
        pill(w / 2 - 50, cy + 18, 100, 28, accent, 1) +
        text(w / 2, cy + 36, 'Set Up Action', {
          size: 11,
          weight: 600,
          color: onAccent(accent),
          anchor: 'middle',
        })
      );
    });
  }
  const done = action.status === 'done';
  const hue = done ? DONE : accent;
  // The name is the title here (two lines, set large), so the kit's own
  // one-line title is left empty and the header drawn below.
  return collabCard(el, '', undefined, color, (w, h) => {
    const chipW = done ? 50 : 48;
    const chip =
      pill(w - PAD_X - chipW, PAD_Y, chipW, 18, hue, 0.14) +
      text(w - PAD_X - chipW / 2, PAD_Y + 12.5, done ? 'Done' : 'Open', {
        size: 10,
        weight: 600,
        color: hue,
        anchor: 'middle',
      });
    const nameLines = wrapLines(action.name, w - PAD_X * 2 - chipW - 8, 15, 2);
    const name = nameLines
      .map((line, i) =>
        text(PAD_X, PAD_Y + 14 + i * 20, line, {
          size: 15,
          weight: 600,
          color,
          opacity: done ? 0.55 : 1,
        }),
      )
      .join('');
    const strike = done
      ? nameLines
          .map(
            (line, i) =>
              `<path d="M ${r2(PAD_X)} ${r2(PAD_Y + 9 + i * 20)} h ${r2(Math.min(w - PAD_X * 2, line.length * 15 * 0.47))}" stroke="${xmlEscape(color)}" stroke-width="1.2" opacity="0.55"/>`,
          )
          .join('')
      : '';
    const y = PAD_Y + 14 + nameLines.length * 20 + 4;
    const description = action.description
      ? wrapLines(action.description, w - PAD_X * 2, 11.5, 3)
          .map((line, i) =>
            text(PAD_X, y + i * 16, line, { size: 11.5, color, opacity: done ? 0.45 : 0.7 }),
          )
          .join('')
      : '';
    const footerY = h - PAD_Y - 34;
    const rowY = footerY - 10 - 42;
    const assignee = action.assignee.name?.trim() || 'Teammate';
    const row =
      roundRect(PAD_X, rowY, w - PAD_X * 2, 42, 12, color, 0.05) +
      personDisc(PAD_X + 22, rowY + 21, 14, color, { initials: initialsOf(assignee), fill: hue }) +
      text(PAD_X + 44, rowY + 18, `Assigned to ${assignee}`, { size: 11.5, weight: 600, color }) +
      (action.assignerName
        ? text(PAD_X + 44, rowY + 32, `from ${action.assignerName}`, {
            size: 10,
            color,
            opacity: 0.55,
          })
        : '');
    const btnW = w - PAD_X * 2 - 42;
    const button = done
      ? roundRect(PAD_X, footerY, btnW, 34, 12, color, 0.08) +
        text(PAD_X + btnW / 2, footerY + 21.5, 'Reopen', {
          size: 12,
          weight: 600,
          color,
          anchor: 'middle',
        })
      : roundRect(PAD_X, footerY, btnW, 34, 12, accent, 1) +
        checkMark(PAD_X + btnW / 2 - 50, footerY + 17, 13, onAccent(accent)) +
        text(PAD_X + btnW / 2 + 8, footerY + 21.5, 'Mark Complete', {
          size: 12,
          weight: 600,
          color: onAccent(accent),
          anchor: 'middle',
        });
    const edit =
      `<circle cx="${r2(w - PAD_X - 17)}" cy="${r2(footerY + 17)}" r="17" fill="${xmlEscape(color)}" fill-opacity="0.08"/>` +
      glyph(w - PAD_X - 17, footerY + 17, 14, color, PENCIL_D);
    return chip + name + strike + description + row + button + edit;
  });
}
