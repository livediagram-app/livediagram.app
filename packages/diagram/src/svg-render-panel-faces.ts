// The Comment and Action panels in the headless render (docs/specs/012-collaboration/comment-pin.md "The
// look", docs/specs/012-collaboration/action-panel.md "The card"), drawn as their canvas faces draw them
// (CommentPanelFace + CommentBubbles, ActionPanelFace + ActionRow): the
// thread as grouped bubbles under their authors with the composer at the
// foot, and the action checklist with the Add Action bar. Motion, hover and
// the composer's live states are left out, as for every face in a still image
// (docs/specs/020-import-export/export-fidelity.md). The accent is the element's stroke (collabAccent).

import { COLLAB_DONE_COLOR as DONE } from './colors';
import type { Comment } from './comments';
import { elementActions } from './element-action';
import { initialsOf } from './names';
import { r2, xmlEscape } from './svg-render-primitives';
import {
  checkMark,
  collabCard,
  PAD_X,
  PAD_Y,
  personDisc,
  text,
  wrapLines,
  type CollabAccent,
  type Face,
} from './svg-render-face-kit';
import {
  ACCENT_BAR_H,
  accentBar,
  accentChip,
  BODY_GAP,
  BODY_TOP,
  COMPOSER_BARE_H,
  composer,
  GLYPH,
  glyph,
  relativeSince,
  roundRect,
} from './svg-render-collab-parts';

// Runs of consecutive comments by one author (CommentBubbles.groupByAuthor).
function groups(comments: readonly Comment[]): Comment[][] {
  const out: Comment[][] = [];
  for (const c of comments) {
    const last = out[out.length - 1];
    const prev = last?.[last.length - 1];
    const same =
      prev !== undefined &&
      (prev.authorId && c.authorId
        ? prev.authorId === c.authorId
        : prev.authorName === c.authorName);
    if (same) last!.push(c);
    else out.push([c]);
  }
  return out;
}

// The "done" chip in a card's header (CollabDoneChip).
function doneChip(right: number, label: string): string {
  const w = label.length * 5.8 + 26;
  const x = right - w;
  return (
    roundRect(x, PAD_Y + 2, w, 18, 9, DONE, 0.14) +
    checkMark(x + 10, PAD_Y + 11, 10, DONE, 1.6) +
    text(x + 18, PAD_Y + 14.5, label, { size: 10, weight: 600, color: DONE })
  );
}

export function svgCommentPanel(el: Face, title: string, color: string, a: CollabAccent): string {
  const thread = el.commentThread;
  const comments = thread?.comments ?? [];
  const resolved = thread?.resolved === true;
  return collabCard(el, title || 'Comments', undefined, color, (w, h) => {
    const inner = w - PAD_X * 2;
    // The header's slot: the Resolve chip once there is a thread, or the
    // green Resolved chip once resolved.
    let out = resolved
      ? doneChip(w - PAD_X, 'Resolved')
      : comments.length
        ? accentChip(
            w - PAD_X - ('Resolve'.length * 5.8 + 22),
            PAD_Y + 2,
            'Resolve',
            a,
            GLYPH.check,
          )
        : '';
    const composerY = h - PAD_Y - COMPOSER_BARE_H;
    if (!resolved) {
      out += composer(
        PAD_X,
        composerY,
        inner,
        comments.length ? 'Reply…' : 'Write a comment…',
        color,
        a,
      );
    } else {
      out += accentBar(PAD_X, h - PAD_Y - ACCENT_BAR_H, inner, 'Reopen Thread', a, GLYPH.reopen);
    }
    const bottom = (resolved ? h - PAD_Y - ACCENT_BAR_H : composerY) - BODY_GAP;
    if (comments.length === 0) {
      const cy = (BODY_TOP + bottom) / 2;
      return (
        out +
        `<circle cx="${r2(w / 2)}" cy="${r2(cy - 22)}" r="14" fill="${xmlEscape(a.accent)}" fill-opacity="0.14"/>` +
        glyph(w / 2, cy - 22, 14, a.ink, GLYPH.bubble) +
        text(w / 2, cy + 8, 'Start the Conversation', {
          size: 12.5,
          weight: 600,
          color,
          anchor: 'middle',
        }) +
        text(w / 2, cy + 26, 'Replies stay on the board for everyone to read.', {
          size: 11,
          color,
          anchor: 'middle',
          opacity: 0.55,
        })
      );
    }
    // Groups from the top, as the canvas lays a thread that fits; one that
    // outgrows the card keeps its newest in view, so the oldest drop first.
    const now = Date.now();
    const bubbleMax = inner - 26;
    const laid = groups(comments).map((g) => {
      const bubbles = g.map((c) => {
        const lines = wrapLines(c.text, bubbleMax - 20, 11.5, 4);
        const width = Math.min(bubbleMax, Math.max(...lines.map((l) => l.length)) * 6 + 20);
        return { lines, width, h: lines.length * 15.8 + 12 };
      });
      const gh = 16 + bubbles.reduce((n, b) => n + b.h + 4, 0);
      return { g, bubbles, gh };
    });
    let start = 0;
    let used = laid.reduce((n, l) => n + l.gh + 10, 0) - 10;
    while (used > bottom - BODY_TOP && start < laid.length - 1) {
      used -= laid[start]!.gh + 10;
      start++;
    }
    let y = BODY_TOP;
    const body = laid
      .slice(start)
      .map(({ g, bubbles, gh }) => {
        const first = g[0]!;
        let gy = y + 16;
        const part =
          personDisc(PAD_X + 10, y + 12, 10, color, {
            initials: first.authorName.trim().charAt(0).toUpperCase() || '?',
            fill: first.authorColor,
          }) +
          text(PAD_X + 30, y + 10, first.authorName, { size: 10, weight: 600, color }) +
          text(
            PAD_X + 36 + first.authorName.length * 6.2,
            y + 10,
            relativeSince(g[g.length - 1]!.createdAt, now),
            {
              size: 10,
              color,
              opacity: 0.45,
            },
          ) +
          bubbles
            .map((b) => {
              const s =
                roundRect(PAD_X + 26, gy, b.width, b.h, 14, color, 0.06) +
                b.lines
                  .map((line, i) =>
                    text(PAD_X + 36, gy + 16 + i * 15.8, line, { size: 11.5, color }),
                  )
                  .join('');
              gy += b.h + 4;
              return s;
            })
            .join('');
        y += gh + 10;
        return part;
      })
      .join('');
    return out + `<g opacity="${resolved ? 0.55 : 1}">${body}</g>`;
  });
}

export function svgActionPanel(el: Face, title: string, color: string, a: CollabAccent): string {
  const actions = elementActions(el);
  const open = actions.filter((x) => x.status !== 'done').length;
  const allDone = actions.length > 0 && open === 0;
  return collabCard(
    el,
    title || 'Actions',
    !allDone && open ? `${open} open` : undefined,
    color,
    (w, h) => {
      const inner = w - PAD_X * 2;
      let out = allDone ? doneChip(w - PAD_X, 'All Done') : '';
      if (actions.length === 0) {
        const cy = h / 2 - 6;
        return (
          out +
          `<circle cx="${r2(w / 2)}" cy="${r2(cy - 28)}" r="14" fill="${xmlEscape(a.accent)}" fill-opacity="0.14"/>` +
          glyph(w / 2, cy - 28, 14, a.ink, GLYPH.clipboard) +
          text(w / 2, cy + 2, 'No Actions Yet', {
            size: 12.5,
            weight: 600,
            color,
            anchor: 'middle',
          }) +
          text(w / 2, cy + 20, 'Give someone a clear next step, with their name on it.', {
            size: 11,
            color,
            anchor: 'middle',
            opacity: 0.55,
          }) +
          roundRect(w / 2 - 56, cy + 34, 112, 34, 17, a.accent, 1) +
          glyph(w / 2 - 34, cy + 51, 12, a.on, GLYPH.plus) +
          text(w / 2 + 8, cy + 55, 'Add Action', {
            size: 12,
            weight: 600,
            color: a.on,
            anchor: 'middle',
          })
        );
      }
      const barY = h - PAD_Y - ACCENT_BAR_H;
      out += accentBar(PAD_X, barY, inner, 'Add Action', a, GLYPH.plus);
      let y = BODY_TOP;
      for (const action of actions) {
        const done = action.status === 'done';
        const who = action.assignee.name?.trim() || 'Teammate';
        const lines = wrapLines(action.name, inner - 48, 12.5, 2);
        const rowH = 8 + lines.length * 17.2 + 4 + 16 + 8;
        if (y + rowH > barY - BODY_GAP) break;
        out += roundRect(PAD_X, y, inner, rowH, 12, color, 0.04);
        const cx = PAD_X + 8 + 11;
        const cy = y + 9 + 11;
        out += done
          ? `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="11" fill="${DONE}"/>` +
            checkMark(cx, cy, 12, '#ffffff', 1.8)
          : `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="10" fill="none" stroke="${xmlEscape(a.accent)}" stroke-opacity="0.6" stroke-width="2"/>`;
        const nx = PAD_X + 40;
        lines.forEach((line, i) => {
          out += text(nx, y + 21 + i * 17.2, line, {
            size: 12.5,
            weight: 600,
            color,
            opacity: done ? 0.5 : undefined,
            strike: done,
          });
        });
        const ay = y + 8 + lines.length * 17.2 + 4 + 8;
        out +=
          personDisc(nx + 8, ay, 8, color, {
            initials: initialsOf(who),
            fill: done ? DONE : a.accent,
          }) + text(nx + 22, ay + 3.5, who, { size: 10.5, color, opacity: 0.65 });
        y += rowH + 6;
      }
      return out;
    },
  );
}
