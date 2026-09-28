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
import { elementActions } from './element-action';
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

export function svgActionPanel(el: Face, title: string, color: string, accent: string): string {
  const actions = elementActions(el);
  const open = actions.filter((a) => a.status !== 'done').length;
  const allDone = actions.length > 0 && open === 0;
  const aside = allDone ? 'All done' : open ? `${open} open` : undefined;
  return collabCard(el, title || 'Actions', aside, color, (w, h) => {
    if (actions.length === 0) {
      const cy = h / 2 + 4;
      return (
        `<circle cx="${r2(w / 2)}" cy="${r2(cy - 24)}" r="14" fill="${xmlEscape(accent)}" fill-opacity="0.14"/>` +
        glyph(w / 2, cy - 24, 14, accent, CLIPBOARD_D) +
        text(w / 2, cy + 4, 'No Actions Yet', { size: 12, weight: 600, color, anchor: 'middle' }) +
        pill(w / 2 - 52, cy + 18, 104, 28, accent, 1) +
        text(w / 2, cy + 36, 'Add Action', {
          size: 11,
          weight: 600,
          color: onAccent(accent),
          anchor: 'middle',
        })
      );
    }
    // One row per action, as many as fit above the Add Action bar.
    const barH = 30;
    const barY = h - PAD_Y - barH;
    const top = PAD_Y + TITLE_PX + 14;
    const rowH = 48;
    const fit = Math.max(1, Math.floor((barY - 8 - top) / (rowH + 6)));
    const rows = actions
      .slice(0, fit)
      .map((a, i) => {
        const y = top + i * (rowH + 6);
        const done = a.status === 'done';
        const who = a.assignee.name?.trim() || 'Teammate';
        const name = wrapLines(a.name, w - PAD_X * 2 - 44, 12.5, 1)[0] ?? a.name;
        const check = done
          ? `<circle cx="${r2(PAD_X + 19)}" cy="${r2(y + 16)}" r="10" fill="${DONE}"/>` +
            checkMark(PAD_X + 19, y + 16, 12, '#ffffff')
          : `<circle cx="${r2(PAD_X + 19)}" cy="${r2(y + 16)}" r="9" fill="none" stroke="${xmlEscape(accent)}" stroke-opacity="0.6" stroke-width="2"/>`;
        return (
          roundRect(PAD_X, y, w - PAD_X * 2, rowH, 12, color, 0.04) +
          check +
          text(PAD_X + 38, y + 20, name, {
            size: 12.5,
            weight: 600,
            color,
            opacity: done ? 0.5 : 1,
          }) +
          personDisc(PAD_X + 46, y + 35, 7, color, {
            initials: initialsOf(who),
            fill: done ? DONE : accent,
          }) +
          text(PAD_X + 58, y + 38.5, who, { size: 10.5, color, opacity: 0.65 })
        );
      })
      .join('');
    const bar =
      `<rect x="${r2(PAD_X)}" y="${r2(barY)}" width="${r2(w - PAD_X * 2)}" height="${barH}" rx="12" fill="${xmlEscape(accent)}" fill-opacity="0.05" stroke="${xmlEscape(accent)}" stroke-opacity="0.45" stroke-dasharray="4 3"/>` +
      text(w / 2, barY + 19, '+ Add Action', {
        size: 11,
        weight: 600,
        color: accent,
        anchor: 'middle',
      });
    return rows + bar;
  });
}
