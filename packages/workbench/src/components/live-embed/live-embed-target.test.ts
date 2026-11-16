// Where a live embed's item lives (live-embeds.md "The frame", "Making one"): the app's origin from this page's host
// (staging from staging), the item's own address, and a pasted share link's app and code.
import { describe, expect, it } from 'vitest';
import { liveEmbedItemHref, liveEmbedOrigin, parseLiveEmbedShareLink } from './live-embed-target';

describe('a live embed item address', () => {
  it("is the item app's live origin, its staging one from a staging page", () => {
    expect(liveEmbedOrigin('liveplanner', 'www.livedocuments.app')).toBe(
      'https://www.liveplanner.app',
    );
    expect(liveEmbedOrigin('livediagram', 'staging.livedesign.app')).toBe(
      'https://staging.livediagram.app',
    );
  });

  it("opens the item at its own app's item path", () => {
    expect(liveEmbedItemHref('liveplanner', 'p 1', 'www.livedocuments.app')).toBe(
      'https://www.liveplanner.app/project/p%201',
    );
    expect(liveEmbedItemHref('livedesign', 'd1', 'www.livediagram.app')).toBe(
      'https://www.livedesign.app/design/d1',
    );
  });
});

describe('a pasted share link', () => {
  it('names the app and the code of any target app, on any of its hosts', () => {
    expect(
      parseLiveEmbedShareLink(' https://www.liveplanner.app/project/shared?s=abc_D-1 '),
    ).toEqual({
      app: 'liveplanner',
      code: 'abc_D-1',
    });
    expect(parseLiveEmbedShareLink('https://livediagram.app/document/shared?s=xyz')).toEqual({
      app: 'livediagram',
      code: 'xyz',
    });
    expect(
      parseLiveEmbedShareLink('https://staging.livedocuments.app/document/shared?s=q&x=1'),
    ).toEqual({ app: 'livedocuments', code: 'q' });
    expect(parseLiveEmbedShareLink('http://localhost:3400/design/shared?s=d')).toEqual({
      app: 'livedesign',
      code: 'd',
    });
  });

  it('is nothing for anything else', () => {
    for (const text of [
      '',
      'not a link',
      'https://evil.example/project/shared?s=abc',
      'https://www.liveplanner.app/project/p1',
      'https://www.liveplanner.app/project/shared',
      'https://www.liveplanner.app/project/shared?s=',
      'https://www.liveplanner.app/project/shared?s=bad code!',
      'https://www.livehuddle.app/document/shared?s=abc',
      'https://www.liveworkspace.app/explorer',
      `https://www.liveplanner.app/project/shared?s=${'a'.repeat(2048)}`,
    ]) {
      expect(parseLiveEmbedShareLink(text)).toBeNull();
    }
  });
});
