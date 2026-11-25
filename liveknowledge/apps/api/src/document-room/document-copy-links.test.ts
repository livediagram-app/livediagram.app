import { describe, expect, it } from 'vitest';
import { remapTabDataLinks } from './document-content';

// A copy's tab bodies at the copy's tab ids (docs/specs/030-knowledgebase/blueprints/page-tree.md "Copies";
// links-and-embeds.md "Page links"): Make a Copy, a Community post's copy and an Explorer duplicate all go through it.
describe('remapTabDataLinks', () => {
  const map = new Map([
    ['guides', 'guides-copy'],
    ['setup', 'setup-copy'],
  ]);
  const body = (fields: Record<string, unknown>) => JSON.stringify({ elements: [], ...fields });
  const linkTo = (page: string) => ({
    main: { blocks: [{ id: 'b1', type: 'paragraph', runs: [{ text: 'Guides', page }] }] },
  });

  it('re-points the page links in the writing at the copied pages', () => {
    const out = JSON.parse(remapTabDataLinks(body({ articles: linkTo('guides') }), map)) as {
      articles: ReturnType<typeof linkTo>;
    };
    expect(out.articles.main.blocks[0]!.runs[0]!.page).toBe('guides-copy');
  });

  it('keeps the page tree: a parent follows its page, one the copy lacks is dropped', () => {
    const moved = JSON.parse(remapTabDataLinks(body({ parent: 'guides' }), map)) as {
      parent?: string;
    };
    expect(moved.parent).toBe('guides-copy');
    expect(JSON.parse(remapTabDataLinks(body({ parent: 'elsewhere' }), map))).not.toHaveProperty(
      'parent',
    );
  });

  it('copies a body that names no page byte for byte, and an unreadable one as it is', () => {
    const plain = body({ articles: { main: { blocks: [] } } });
    expect(remapTabDataLinks(plain, map)).toBe(plain);
    const other = body({ articles: linkTo('elsewhere') });
    expect(remapTabDataLinks(other, map)).toBe(other);
    expect(remapTabDataLinks('{"page": oops', map)).toBe('{"page": oops');
    expect(remapTabDataLinks('null', map)).toBe('null');
  });
});
