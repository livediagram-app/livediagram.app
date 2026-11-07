import { formatCommunityCount } from '@liveworkspace/community-ui';
import { describe, expect, it } from 'vitest';
import { capitalise, formatDate, paragraphs } from './format';
import { isMinePost } from './gallery-post';
import { communityLinks, communityPostPath, tagHref } from './links';

// The Community pages' small pure helpers: every link they build encodes what came from a post, so nothing in an id
// or tag can break out of its parameter.

const origin = (app: string) => `https://www.${app}.app`;

describe('links', () => {
  it('encodes ids and tags into their parameter', () => {
    expect(communityPostPath('a/b?c')).toBe('/community/post?id=a%2Fb%3Fc');
    expect(tagHref('event-driven')).toBe('/community?q=%23event-driven');
  });

  it("opens this address's posts in place, and another app's on its own address", () => {
    const links = communityLinks('livediagram.app', origin);
    expect(links.post({ id: 'p1', app: 'livediagram.app' })).toEqual({
      href: '/community/post?id=p1',
      external: false,
    });
    expect(links.post({ id: 'p1', app: 'livedesign.app' })).toEqual({
      href: 'https://www.livedesign.app/community/post?id=p1',
      external: true,
    });
    expect(links.image({ app: 'livediagram.app', shareCode: 'S 1' })).toBe(
      '/api/share/S%201/image.svg',
    );
    expect(links.image({ app: 'livedocuments.app', shareCode: 'S1' })).toBe(
      'https://www.livedocuments.app/api/share/S1/image.svg',
    );
    expect(links.shareYourOwn).toBe('/explorer/home');
  });

  it("names each app's own routes: livedesign's designs, everyone else's documents", () => {
    const links = communityLinks('livedesign.app', origin);
    expect(links.makeCopy({ app: 'livedesign.app', shareCode: 'S1' })).toBe(
      '/design/shared?s=S1&copy=1',
    );
    expect(links.openDocument({ app: 'livediagram.app', shareCode: 'S1' })).toBe(
      'https://www.livediagram.app/document/shared?s=S1',
    );
    expect(links.editDocument({ app: 'livedesign.app', documentId: 'd 1' })).toBe('/design/d%201');
    expect(links.embed({ app: 'livedesign.app', shareCode: 'S1' })).toBe('/embed?s=S1');
  });

  it("opens and copies liveplanner's plans at its project addresses (Open Plan, Make a Copy)", () => {
    const links = communityLinks('liveplanner.app', origin);
    expect(links.openDocument({ app: 'liveplanner.app', shareCode: 'S 1' })).toBe(
      '/project/shared?s=S%201',
    );
    expect(links.makeCopy({ app: 'liveplanner.app', shareCode: 'S1' })).toBe(
      '/project/shared?s=S1&copy=1',
    );
    expect(links.editDocument({ app: 'liveplanner.app', documentId: 'p1' })).toBe('/project/p1');
    expect(communityLinks(null, origin).makeCopy({ app: 'liveplanner.app', shareCode: 'S1' })).toBe(
      'https://www.liveplanner.app/project/shared?s=S1&copy=1',
    );
  });

  it('leads every post away from liveworkspace.app, and Share Your Own to its Explorer', () => {
    const links = communityLinks(null, origin);
    expect(links.post({ id: 'p1', app: 'livediagram.app' }).external).toBe(true);
    expect(links.shareYourOwn).toBe('/explorer');
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
