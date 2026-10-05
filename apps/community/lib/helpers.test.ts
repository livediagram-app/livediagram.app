import { describe, expect, it } from 'vitest';
import { formatCount, formatDate, paragraphs } from './format';
import { isMinePost } from './gallery-post';
import {
  editDocumentHref,
  embedHref,
  makeCopyHref,
  openBoardHref,
  postHref,
  tagHref,
} from './links';
import { signInHref } from './session';

// The Community app's small pure helpers (docs/specs/025-community/community.md): every link it builds encodes
// what came from a post, so nothing in a code, id or tag can break out of its parameter.

describe('links', () => {
  it('encodes codes, ids and tags into their parameter', () => {
    expect(openBoardHref('AB c&d')).toBe('/document/shared?s=AB%20c%26d');
    expect(makeCopyHref('CODE1')).toBe('/document/shared?s=CODE1&copy=1');
    expect(embedHref('CODE1')).toBe('/embed?s=CODE1');
    expect(postHref('a/b?c')).toBe('/post/?id=a%2Fb%3Fc');
    expect(tagHref('event-driven')).toBe('/?q=%23event-driven');
    expect(editDocumentHref('doc/1')).toBe('/document/doc%2F1');
  });

  it('sends sign-in back to the same view', () => {
    expect(signInHref('/community/?q=is%3Amine')).toBe(
      '/sign-in/?redirect_url=%2Fcommunity%2F%3Fq%3Dis%253Amine',
    );
  });
});

describe('format', () => {
  it('shortens big counts and spells out dates', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
    // The compact suffix's case depends on the runtime's locale data (1.2K in browsers, 1.2k in some Node builds).
    expect(formatCount(1200).toUpperCase()).toBe('1.2K');
    expect(formatCount(34_000).toUpperCase()).toBe('34K');
    expect(formatDate(Date.UTC(2026, 9, 5, 12))).toBe('5 October 2026');
  });

  it('splits a description into paragraphs on blank lines', () => {
    expect(paragraphs('One.\n\n\n Two. \n\nThree.')).toEqual(['One.', 'Two.', 'Three.']);
    expect(paragraphs('  ')).toEqual([]);
  });
});

describe('isMinePost', () => {
  it("tells an author's own post (with its document) from a public one", () => {
    expect(isMinePost({ documentId: 'd1' } as never)).toBe(true);
    expect(isMinePost({ id: 'p1' } as never)).toBe(false);
  });
});
