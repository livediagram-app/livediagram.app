// The Idea box in the headless render (docs/specs/012-collaboration/idea-box.md "The look"), drawn as its canvas
// face draws it: rows with the 36x42 box on the left (an idea's number), the text and the anonymous author, the
// one facilitator act as a dashed accent bar, and the composer at the foot. It reflows (collabCard): a bigger box
// shows more rows at the same size.

import { lockMark, text, wrapLines, type CollabAccent, type Face } from './svg-render-face-kit';
import { collabCard, PAD_X, PAD_Y } from './svg-render-face-kit';
import {
  ACCENT_BAR_H,
  accentBar,
  accentChip,
  anonymousChip,
  BODY_GAP,
  BODY_TOP,
  COMPOSER_H,
  composer,
  countBox,
  GLYPH,
  roundRect,
} from './svg-render-collab-parts';

const ROW_GAP = 6;
const LINE = 16.5;

// One row: the box, then the text (up to four lines) and the anonymous author line.
function row(
  x: number,
  y: number,
  w: number,
  o: { box: string; text: string },
  color: string,
): { svg: string; h: number } {
  const colX = x + 54;
  const colW = w - 54 - 12;
  let cy = y + 8;
  let parts = '';
  const lines = wrapLines(o.text, colW, 12, 4);
  lines.forEach((line, i) => {
    parts += text(colX, cy + 12 + i * LINE, line, { size: 12, weight: 500, color });
  });
  cy += lines.length * LINE + 4;
  parts += anonymousChip(colX, cy + 7, color);
  cy += 14;
  const h = Math.max(42, cy - y - 8) + 16;
  const bg = roundRect(x, y, w, h, 12, color, 0.04);
  return { svg: bg + o.box + parts, h };
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
            box: countBox(x + 8, y + 8, String(i + 1), color),
            text: cards[i]!,
          },
          color,
        );
        if (y + r.h > composerY - BODY_GAP) break;
        out += r.svg;
        y += r.h + ROW_GAP;
      }
      return out;
    },
  );
}
