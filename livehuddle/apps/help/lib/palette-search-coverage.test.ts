import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { searchArticles } from './articles';

// Every name the palette shows must find something in the help centre.
//
// searchArticles matches an article's title, description and keywords — never
// its BODY. So an article can explain a thing thoroughly and still be
// unfindable by its own name, which is what had happened: the Shapes article
// names the hexagon, the trapezoid, the stadium, the parallelogram and the
// speech bubble, and searching any of them returned nothing at all. Twelve
// terms were in that state before this guard existed.
//
// Two vocabularies, because the palette has two.
//
// Most tiles carry a `caption` — the short name shown under the tile ("Note",
// "Idea box", "Dot vote"), which is what somebody types when they go looking
// for help about it. SHAPE tiles carry none: the grid shows the glyph, and the
// shape's name lives in its label as "Add Hexagon". So the shapes section
// contributes its label with the "Add " stripped.
//
// Other sections' labels are deliberately NOT checked. Theirs are phrases
// ("Add Avatar Mode Button"), nobody searches a whole sentence, and requiring
// them would push noise into the keywords rather than find real gaps. The
// first version of this guard checked captions alone and would have passed
// while "hexagon" returned nothing, which is what prompted the split.
//
// Only the tiles the meeting palette offers count (docs/specs/012-collaboration/workshop-mode.md "The palette"): the
// tile catalogue still holds the leaving kinds' tiles, which no strip, category or search offers and whose articles
// left with them (Work Tracker #423). So the names are read through the meeting palette's layout: the tiles it names,
// plus the Collaborate groups (React, Selection Mode) it lists whole.
//
// Reading apps/editor from apps/help is the coupling ui-labels-in-articles,
// repo-paths-in-docs and shortcut-coverage already take on: the help centre's
// findability genuinely depends on the editor's vocabulary.
const PALETTE_DIR = '../../editor/components/palette/';
const read = (file: string) =>
  readFileSync(fileURLToPath(new URL(`${PALETTE_DIR}${file}`, import.meta.url)), 'utf8');

function paletteNames(): string[] {
  const layouts = read('palette-layouts.ts');
  const defs = read('palette-tile-defs.tsx');
  const offered = new Set(
    [...layouts.matchAll(/'((?:tools|shapes):[a-z0-9-]+)'/g)].map((m) => m[1]!),
  );
  // The Collaborate categories a layout lists without its own tiles hold their whole tile group.
  const groupOf = Object.fromEntries(
    [...defs.matchAll(/'(collab-[a-z]+)': '([a-z]+)'/g)].map((m) => [m[1]!, m[2]!]),
  );
  const wholeGroups = new Set(
    [...layouts.matchAll(/\{ id: '(collab-[a-z]+)' \}/g)].map((m) => groupOf[m[1]!]),
  );
  const names: string[] = [];
  for (const tile of defs.split(/\n {2}\{\n/)) {
    const id = /^\s*id: '([^']+)'/m.exec(tile)?.[1];
    const group = /tileGroup: '([^']+)'/.exec(tile)?.[1];
    if (!id || !(offered.has(id) || (group && wholeGroups.has(group)))) continue;
    const caption = /caption: '([^']+)'/.exec(tile);
    const label = /label: 'Add ([^']+)'/.exec(tile);
    if (caption) names.push(caption[1]!);
    else if (id.startsWith('shapes:') && label) names.push(label[1]!);
  }
  return [...new Set(names)];
}

describe('the help centre can be searched for what the palette calls things', () => {
  it('reads real palette names (guard against this test going blind)', () => {
    // 75 when this landed (62 captions plus the shape labels), about 30 once the palette became the meeting palette
    // (Work Tracker #423). A collapse toward zero would make the assertion below pass without checking anything.
    expect(paletteNames().length).toBeGreaterThan(20);
  });

  it('does not simply match everything', () => {
    // The other way this guard could pass vacuously: a search that returns the
    // whole catalogue for any input would "find" every caption.
    expect(searchArticles('zzzznotathing')).toHaveLength(0);
  });

  it('finds an article for every palette name', () => {
    const missing = paletteNames()
      .filter((c) => searchArticles(c).length === 0)
      .sort();
    expect(missing).toEqual([]);
  });
});
