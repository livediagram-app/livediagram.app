// The guard of an infographic page's Tidy Up (docs/specs/007-editor/pages-mode.md "Tidy";
// lib/page-tidy.ts): nothing comes to overlap what it did not.
import { overlaps, sameRect, shift, type Block, type Rect } from './page-tidy-blocks';

// Every rect in a block and inside it, the block's own first.
export const rectsIn = (b: Block): Rect[] => [b.rect, ...b.children.flatMap(rectsIn)];

// How far a block is from where it started at this level (0 when it is there).
const moved = (b: Block) =>
  sameRect(b.rect, b.start)
    ? 0
    : Math.abs(b.rect.x - b.start.x) +
      Math.abs(b.rect.y - b.start.y) +
      Math.abs(b.rect.width - b.start.width) +
      Math.abs(b.rect.height - b.start.height);

// Step 5: a block (or anything inside it) overlapping one it did not overlap at the level's start
// goes back, and stays; so does one overlapping an obstacle (something outside this level that
// reaches into it) it did not. Repeated, as one going back can land on another that moved onto its
// old place. Overlaps are keyed by the pair of blocks and the rects within them (rectsIn's order),
// so a card's text running into a badge that only overlapped the card's edge counts.
type Overlaps = Set<string>;

// Whether two blocks' rects overlap anywhere (outer rects first, the cheap reject), each overlap
// added to `out` when given; with `before`, only an overlap not in it counts.
function deepOverlap(
  p: Rect[],
  q: Rect[],
  key: string,
  { out, before }: { out?: Overlaps; before?: Overlaps },
): boolean {
  if (!overlaps(p[0]!, q[0]!)) return false;
  let found = false;
  for (let a = 0; a < p.length; a++)
    for (let b = 0; b < q.length; b++) {
      if (!overlaps(p[a]!, q[b]!)) continue;
      const k = `${key}:${a}|${b}`;
      if (before?.has(k)) continue;
      out?.add(k);
      found = true;
      if (!out) return true;
    }
  return found;
}

export function overlapsAt(blocks: Block[], obstacles: readonly Rect[]): Overlaps {
  const out: Overlaps = new Set();
  const deep = blocks.map(rectsIn);
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++)
      deepOverlap(deep[i]!, deep[j]!, `${i}|${j}`, { out });
    obstacles.forEach((o, k) => deepOverlap(deep[i]!, [o], `${i}|o${k}`, { out }));
  }
  return out;
}

function sendBack(b: Block) {
  b.rect = { ...b.rect, width: b.start.width, height: b.start.height };
  shift(b, b.start.x - b.rect.x, b.start.y - b.rect.y);
  b.movable = false;
}

// Rounds over every pair until one sends nothing back. Two blocks both where they started cannot
// overlap anew, so only pairs with a mover are looked at.
export function guard(blocks: Block[], obstacles: readonly Rect[], before: Overlaps): boolean {
  let reverted = false;
  for (let again = true; again;) {
    again = false;
    const deep = blocks.map(rectsIn);
    const away = blocks.map(moved);
    const back = (i: number) => {
      sendBack(blocks[i]!);
      deep[i] = rectsIn(blocks[i]!);
      away[i] = 0;
      again = reverted = true;
    };
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        if (away[i] === 0 && away[j] === 0) continue;
        if (!deepOverlap(deep[i]!, deep[j]!, `${i}|${j}`, { before })) continue;
        // The one that moved goes back, or the one that moved further.
        back(away[i]! >= away[j]! ? i : j);
      }
      if (away[i] === 0) continue;
      for (let k = 0; k < obstacles.length; k++) {
        if (!deepOverlap(deep[i]!, [obstacles[k]!], `${i}|o${k}`, { before })) continue;
        back(i);
        break;
      }
    }
  }
  return reverted;
}
