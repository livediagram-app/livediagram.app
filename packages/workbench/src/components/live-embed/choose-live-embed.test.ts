// Choosing a live embed's file (live-embeds.md "Making one"): which files can be chosen, the choice with a fresh
// snapshot, the element it makes, and a pasted link resolved with its code dropped.
import { describe, expect, it, vi } from 'vitest';
import { IndexError, type Item } from '@liveworkspace/index-client';
import {
  choiceOf,
  liveEmbedBlock,
  resolvePastedLink,
  withLiveEmbedChoice,
} from './choose-live-embed';

const item = (over: Partial<Item> = {}) =>
  ({ id: 'p1', app: 'liveplanner', title: 'Roadmap', ...over }) as Item;

describe('which files a live embed can show', () => {
  it('is any of the four apps’ files but the host itself', () => {
    expect(liveEmbedBlock(item(), 'doc1')).toBeNull();
    expect(liveEmbedBlock(item({ id: 'doc1' }), 'doc1')).toBe('This is the file you are in.');
    expect(liveEmbedBlock(item({ app: 'livehuddle' }), 'doc1')).toBe(
      'Files from this app cannot be shown live yet.',
    );
  });
});

describe('a choice', () => {
  it('is the link and a fresh snapshot, drawn in the appearance asked', async () => {
    const capture = vi.fn(async () => 'data:image/webp;base64,AA==');
    expect(await choiceOf(item({ title: 'x'.repeat(250) }), 'dark', capture)).toEqual({
      liveItem: { app: 'liveplanner', itemId: 'p1' },
      liveName: 'x'.repeat(200),
      livePoster: 'data:image/webp;base64,AA==',
    });
    expect(capture).toHaveBeenCalledWith('p1', 'dark');
  });

  it('leaves the picture out when there is none, and refuses another app’s file', async () => {
    expect(await choiceOf(item(), 'light', async () => null)).toEqual({
      liveItem: { app: 'liveplanner', itemId: 'p1' },
      liveName: 'Roadmap',
    });
    await expect(
      choiceOf(item({ app: 'livehuddle' }), 'light', async () => null),
    ).rejects.toThrow();
  });

  it('makes the embed live: the link and snapshot replaced, any web address gone', () => {
    const el = {
      id: 'e',
      type: 'video',
      embedProvider: 'website',
      link: { kind: 'url', url: 'https://example.com' },
      livePoster: 'data:image/png;base64,old=',
    };
    expect(
      withLiveEmbedChoice(el, {
        liveItem: { app: 'livediagram', itemId: 'd1' },
        liveName: 'Architecture',
      }),
    ).toEqual({
      id: 'e',
      type: 'video',
      embedProvider: 'live',
      liveItem: { app: 'livediagram', itemId: 'd1' },
      liveName: 'Architecture',
    });
    expect(
      withLiveEmbedChoice(el, {
        liveItem: { app: 'livediagram', itemId: 'd1' },
        liveName: 'A',
        livePoster: 'data:image/webp;base64,new=',
      }).livePoster,
    ).toBe('data:image/webp;base64,new=');
  });
});

describe('a pasted share link', () => {
  const LINK = 'https://www.liveplanner.app/project/shared?s=code1';

  it('resolves to its file through the index, as opening it would', async () => {
    const client = {
      resolveShare: vi.fn(async () => ({ item: item(), level: 'view' as const, tabId: null })),
    };
    expect(await resolvePastedLink(LINK, client)).toEqual({ ok: true, item: item() });
    expect(client.resolveShare).toHaveBeenCalledWith('code1');
  });

  it('says why when it cannot be used', async () => {
    const refusing = (error: unknown) => ({
      resolveShare: vi.fn(async () => {
        throw error;
      }),
    });
    expect(await resolvePastedLink('nope', refusing(null))).toMatchObject({
      ok: false,
      words: 'Paste a share link from livediagram, liveplanner, livedocuments or livedesign.',
    });
    const words = async (error: unknown) =>
      ((await resolvePastedLink(LINK, refusing(error))) as { words: string }).words;
    expect(await words(new IndexError(401, 'password_required'))).toMatch(/has a password/);
    expect(await words(new IndexError(403, 'password_invalid'))).toMatch(/has a password/);
    expect(await words(new IndexError(410, 'trashed'))).toBe('That file is no longer there.');
    expect(await words(new IndexError(404, 'not_found'))).toBe(
      'That link no longer opens anything.',
    );
    expect(await words(new IndexError(403, 'forbidden'))).toBe(
      'That link no longer opens anything.',
    );
    expect(await words(new IndexError(503, 'down'))).toMatch(/just now/);
    expect(await words(new Error('offline'))).toMatch(/just now/);
  });
});
