import { formatCommunityCount } from '@liveworkspace/community-ui';
import { describe, expect, it } from 'vitest';
import { capitalise, formatDate, paragraphs } from './format';
import { isMinePost } from './gallery-post';
import { communityPostPath, postHref, tagHref } from './links';

// The Community pages' small pure helpers: every link they build encodes what came from a post, so nothing in an id
// or tag can break out of its parameter. The app's own routes are its binding's (lib/community-site.tsx in each app).

describe('links', () => {
  it('encodes ids and tags into their parameter', () => {
    expect(postHref('a/b?c')).toBe('/post/?id=a%2Fb%3Fc');
    expect(communityPostPath('a/b?c')).toBe('/community/post/?id=a%2Fb%3Fc');
    expect(tagHref('event-driven')).toBe('/?q=%23event-driven');
  });
});

describe('format', () => {
  it('shortens big counts and spells out dates', () => {
    expect(formatCommunityCount(0)).toBe('0');
    expect(formatCommunityCount(999)).toBe('999');
    // The compact suffix's case depends on the runtime's locale data (1.2K in browsers, 1.2k in some Node builds).
    expect(formatCommunityCount(1200).toUpperCase()).toBe('1.2K');
    expect(formatCommunityCount(34_000).toUpperCase()).toBe('34K');
    expect(formatDate(Date.UTC(2026, 9, 5, 12))).toBe('5 October 2026');
  });

  it('splits a description into paragraphs on blank lines', () => {
    expect(paragraphs('One.\n\n\n Two. \n\nThree.')).toEqual(['One.', 'Two.', 'Three.']);
    expect(paragraphs('  ')).toEqual([]);
  });

  it("starts the app's noun with a capital", () => {
    expect(capitalise('canvases')).toBe('Canvases');
    expect(capitalise('')).toBe('');
  });
});

describe('isMinePost', () => {
  it("tells an author's own post (with its document) from a public one", () => {
    expect(isMinePost({ documentId: 'd1' } as never)).toBe(true);
    expect(isMinePost({ id: 'p1' } as never)).toBe(false);
  });
});
