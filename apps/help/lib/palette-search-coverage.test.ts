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
// shape's name lives in its label as "Add hexagon". So the shapes section
// contributes its label with the "Add " stripped.
//
// Other sections' labels are deliberately NOT checked. Theirs are phrases
// ("Add Avatar mode button"), nobody searches a whole sentence, and requiring
// them would push noise into the keywords rather than find real gaps. The
// first version of this guard checked captions alone and would have passed
// while "hexagon" returned nothing, which is what prompted the split.
//
// Reading apps/live from apps/help is the coupling ui-labels-in-articles,
// repo-paths-in-docs and shortcut-coverage already take on: the help centre's
// findability genuinely depends on the editor's vocabulary.
const TILE_DEFS = fileURLToPath(
  new URL('../../live/components/palette/palette-tile-defs.tsx', import.meta.url),
);

function paletteNames(): string[] {
  const src = readFileSync(TILE_DEFS, 'utf8');
  const names = [...src.matchAll(/caption: '([^']+)'/g)].map((m) => m[1]!);
  for (const tile of src.split(/\n {2}\{\n/)) {
    if (!/id: 'shapes:/.test(tile)) continue;
    const label = /label: 'Add ([^']+)'/.exec(tile);
    if (label) names.push(label[1]!);
  }
  return [...new Set(names)];
}

describe('the help centre can be searched for what the palette calls things', () => {
  it('reads real palette names (guard against this test going blind)', () => {
    // 75 when this landed (62 captions plus the shape labels). A collapse toward zero would make the assertion
    // below pass without checking anything.
    expect(paletteNames().length).toBeGreaterThan(40);
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
