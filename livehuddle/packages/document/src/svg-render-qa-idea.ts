// The Q&A board and the Idea box in the headless render
// (docs/specs/012-collaboration/qa-board.md, idea-box.md "The look"), drawn as their canvas faces draw them:
// rows with the 36x42 box on the left (a vote pill, an idea's number), the
// text and its author, the one facilitator act as a dashed accent bar, and the
// composer at the foot. Both reflow (collabCard): a bigger board shows more
// rows at the same size.

import { qaView, type QaNote } from './qa-board';
import {
  lockMark,
  rule,
  text,
  wrapLines,
  type CollabAccent,
  type Face,
} from './svg-render-face-kit';
import { collabCard, PAD_X, PAD_Y } from './svg-render-face-kit';
import {
  ACCENT_BAR_H,
  accentBar,
  accentChip,
  authorChip,
  BODY_GAP,
  BODY_TOP,
  COMPOSER_H,
  composer,
  countBox,
  glyph,
  GLYPH,
  relativeAge,
  roundRect,
} from './svg-render-collab-parts';

const ROW_GAP = 6;
const LINE = 16.5;
// The folded Discussed drawer's header row (QaDiscussed), the state it shows
// until somebody opens it.
const DRAWER_H = 22;

function discussedDrawer(x: number, y: number, w: number, count: number, color: string): string {
  const label = `Discussed · ${count}`;
  const cy = y + DRAWER_H / 2;
  // Uppercase 10.5px with 0.08em tracking runs about 0.72em a character.
  const textEnd = x + 26 + label.length * 10.5 * 0.72;
  return (
    `<circle cx="${x + 9}" cy="${cy}" r="8" fill="${color}" fill-opacity="0.1"/>` +
    glyph(x + 9, cy, 9, color, GLYPH.check) +
    text(x + 24, cy + 3.7, label, {
      size: 10.5,
      weight: 600,
      color,
      opacity: 0.7,
      uppercase: true,
      tracking: 0.08,
    }) +
    rule(textEnd, cy, x + w - 18, color, 0.12) +
    glyph(x + w - 8, cy, 10, color, 'M4.5 6.5 8 10l3.5-3.5')
  );
}

// One row: the box, then the text (up to four lines), the author line, and on
// the top-voted note a Most Wanted tag and a lit row.
function row(
  x: number,
  y: number,
  w: number,
  o: {
    box: string;
    text: string;
    author: QaNote['author'];
    age?: string;
    top?: boolean;
    heat?: number;
  },
  color: string,
  a: CollabAccent,
): { svg: string; h: number } {
  const colX = x + 54;
  const colW = w - 54 - 12;
  let cy = y + 8;
  let parts = '';
  if (o.top) {
    parts +=
      roundRect(colX, cy, 76, 14, 7, a.accent, 0.14) +
      text(colX + 6, cy + 10, 'MOST WANTED', { size: 9, weight: 700, color: a.ink });
    cy += 18;
  }
  const lines = wrapLines(o.text, colW, 12, 4);
  lines.forEach((line, i) => {
    parts += text(colX, cy + 12 + i * LINE, line, { size: 12, weight: 500, color });
  });
  cy += lines.length * LINE + 4;
  parts += authorChip(colX, cy + 7, o.author, color);
  if (o.age) {
    const nameW = (o.author?.name ?? 'Anonymous').length * 5.6;
    parts += text(colX + 24 + nameW, cy + 10.5, `· ${o.age}`, { size: 10, color, opacity: 0.4 });
  }
  cy += 14;
  const h = Math.max(42, cy - y - 8) + 16;
  const bg = o.top
    ? roundRect(x, y, w, h, 12, a.accent, 0.09, { color: a.accent, opacity: 0.28 })
    : roundRect(x, y, w, h, 12, color, 0.04);
  const heat = o.heat && o.heat > 0 ? roundRect(x, y + h - 2, w * o.heat, 2, 1, a.accent, 0.8) : '';
  return { svg: bg + o.box + parts + heat, h };
}

export function svgQaBoard(el: Face, title: string, color: string, a: CollabAccent): string {
  const { discussing, queue, done } = qaView(el.qaNotes);
  const total = queue.length + done.length + (discussing ? 1 : 0);
  return collabCard(
    el,
    title || 'Questions',
    total ? `${total} ${total === 1 ? 'note' : 'notes'}` : undefined,
    color,
    (w, h) => {
      const x = PAD_X;
      const width = w - PAD_X * 2;
      const composerY = h - PAD_Y - COMPOSER_H;
      const meta =
        roundRect(x + 6, composerY + 40, 76, 18, 9, color, 0.06) +
        roundRect(x + 8, composerY + 42, 28, 14, 7, color, 0.18) +
        `<circle cx="${x + 15}" cy="${composerY + 49}" r="5" fill="#ffffff"/>` +
        text(x + 42, composerY + 52.5, 'As you', { size: 10, weight: 600, color, opacity: 0.8 });
      let out = composer(x, composerY, width, 'Add a note…', color, a, meta);
      let y = BODY_TOP;
      // Empty only when nothing was ever discussed either: a board whose
      // every note is done shows its Discussed drawer, as the canvas does.
      if (queue.length === 0 && !discussing && done.length === 0) {
        out += text(w / 2, (BODY_TOP + composerY) / 2, 'No notes yet', {
          size: 12.5,
          weight: 600,
          color,
          anchor: 'middle',
        });
        return out;
      }
      if (!discussing && queue.length > 0) {
        out += accentBar(x, y, width, 'Discuss the Top Note', a, GLYPH.bubble);
        y += ACCENT_BAR_H + BODY_GAP;
      }
      const maxVotes = queue.reduce((m, n) => Math.max(m, n.voters.length), 0);
      const now = Date.now();
      const rows = discussing ? [discussing, ...queue] : queue;
      // Rows stop short of the drawer, when there is one, so it always shows.
      const rowsEnd = composerY - BODY_GAP - (done.length > 0 ? DRAWER_H + ROW_GAP : 0);
      for (let i = 0; i < rows.length; i++) {
        const n = rows[i]!;
        const votes = n.voters.length;
        const r = row(
          x,
          y,
          width,
          {
            box: countBox(x + 8, y + 8, String(votes), color, true),
            text: n.text,
            author: n.author,
            age: relativeAge(n.at, now),
            top: n === discussing || (i === 0 && votes > 0),
            heat: maxVotes > 0 ? votes / maxVotes : 0,
          },
          color,
          a,
        );
        if (y + r.h > rowsEnd) break;
        out += r.svg;
        y += r.h + ROW_GAP;
      }
      if (done.length > 0) out += discussedDrawer(x, y, width, done.length, color);
      return out;
    },
  );
}

export function svgIdeaBox(el: Face, title: string, color: string, a: CollabAccent): string {
  const cards = el.ideaCards ?? [];
  const open = el.ideasRevealed === true;
  const count = cards.length;
  return collabCard(
    el,
    title || 'Ideas',
    count ? `${count} ${count === 1 ? 'idea' : 'ideas'}` : undefined,
    color,
    (w, h) => {
      const x = PAD_X;
      const width = w - PAD_X * 2;
      const composerY = h - PAD_Y - COMPOSER_H;
      let out = composer(
        x,
        composerY,
        width,
        'Add an idea…',
        color,
        a,
        accentChip(x + 6, composerY + 40, 'Anonymous', a, GLYPH.mask),
      );
      let y = BODY_TOP;
      if (count === 0) {
        out += text(w / 2, (BODY_TOP + composerY) / 2, 'Nothing in the box yet', {
          size: 12.5,
          weight: 600,
          color,
          anchor: 'middle',
        });
        return out;
      }
      if (!open) {
        out += accentBar(x, y, width, `Open the Box (${count})`, a, GLYPH.eye);
        y += ACCENT_BAR_H + BODY_GAP;
        // The sealed plate (IdeaSealed): the lock in its disc, the count.
        const ph = 138;
        out +=
          roundRect(x, y, width, ph, 12, color, 0.04, { color, opacity: 0.08 }) +
          `<circle cx="${w / 2}" cy="${y + 31}" r="15" fill="${a.accent}" fill-opacity="0.14"/>` +
          lockMark(w / 2, y + 31, 15, a.ink) +
          text(w / 2, y + 76, String(count), { size: 26, weight: 700, color, anchor: 'middle' }) +
          text(w / 2, y + 96, count === 1 ? 'idea sealed' : 'ideas sealed', {
            size: 11,
            weight: 600,
            color,
            anchor: 'middle',
          }) +
          text(w / 2, y + 114, 'Hidden from everyone until the box is opened.', {
            size: 10.5,
            color,
            anchor: 'middle',
            opacity: 0.55,
          });
        return out;
      }
      out += accentBar(x, y, width, 'Scatter to Sticky Notes', a, GLYPH.scatter);
      y += ACCENT_BAR_H + BODY_GAP;
      for (let i = 0; i < cards.length; i++) {
        const r = row(
          x,
          y,
          width,
          {
            box: countBox(x + 8, y + 8, String(i + 1), color, false),
            text: cards[i]!,
            author: undefined,
          },
          color,
          a,
        );
        if (y + r.h > composerY - BODY_GAP) break;
        out += r.svg;
        y += r.h + ROW_GAP;
      }
      return out;
    },
  );
}
