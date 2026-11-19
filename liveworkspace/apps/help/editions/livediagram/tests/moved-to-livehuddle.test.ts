import { describe, expect, it } from 'vitest';
import { appliesTo, canonicalArticleUrl } from '@liveworkspace/help-registry';
import { allArticles } from '@liveworkspace/help-registry/catalogue';
import { articlePath } from '@liveworkspace/help-registry/telemetry';
import { movedToLivehuddle } from '@/editions/livediagram/lib/moved-to-livehuddle';

// The articles that moved to livehuddle (Work Tracker #650). livediagram's help kept a stub at each old path that
// sent a link on to livehuddle's help; in the one help centre each path is one article that applies to livehuddle
// and not livediagram, so the help Worker answers livediagram's address with a 308 to the article's canonical one on
// livehuddle (liveworkspace/docs/specs/016-help/help-centre.md "Addresses, canonicals and the old paths").
const MOVED = [
  'palette/avatar-pads',
  'palette/chairs',
  'palette/fences',
  'palette/virtual-office',
  'palette/virtual-office/turning-furniture',
  'selection-modes/avatar-mode',
  'selection-modes/avatar-mode/avatar-tour',
  'selection-modes/walking-together',
];

describe('the articles moved to livehuddle', () => {
  it.each(MOVED)("%s is livehuddle's, not livediagram's, and canonical on livehuddle", (path) => {
    const article = allArticles.find((a) => articlePath(a) === path);
    expect(article, path).toBeDefined();
    expect(appliesTo(article!, 'livehuddle'), path).toBe(true);
    expect(appliesTo(article!, 'livediagram'), path).toBe(false);
    expect(canonicalArticleUrl(article!)).toBe(`https://www.livehuddle.app/help/${path}/`);
  });

  it('keeps the moved link helper pointing at the same path in livehuddle, noindex, with that page canonical', () => {
    const moved = movedToLivehuddle('palette/chairs', 'Chairs');
    expect(moved.href).toBe('https://www.livehuddle.app/help/palette/chairs/');
    expect(moved.metadata.robots).toEqual({ index: false, follow: true });
    expect(moved.metadata.alternates).toEqual({ canonical: moved.href });
    expect(moved.label).toBe("Chairs guide in livehuddle's help");
  });
});
