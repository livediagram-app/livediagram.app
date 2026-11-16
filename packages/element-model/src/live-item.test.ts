import { describe, expect, it } from 'vitest';
import { firstFieldIssue } from '@liveworkspace/model-core/validate-primitives';
import {
  LIVE_EMBED_CHECKS,
  LIVE_NAME_MAX,
  LIVE_POSTER_MAX_CHARS,
  isLiveEmbedApp,
  isLiveItem,
  isLiveName,
  isLivePoster,
  withoutLiveItem,
} from './live-item';

describe('a live embed link', () => {
  it('names one of the four apps and an index item id, nothing more', () => {
    expect(isLiveItem({ app: 'liveplanner', itemId: 'abc_123-X' })).toBe(true);
    for (const app of ['livediagram', 'livedocuments', 'livedesign']) {
      expect(isLiveItem({ app, itemId: 'a' })).toBe(true);
    }
    expect(isLiveItem({ app: 'livehuddle', itemId: 'a' })).toBe(false);
    expect(isLiveItem({ app: 'liveplanner', itemId: 'a b' })).toBe(false);
    expect(isLiveItem({ app: 'liveplanner', itemId: 'x'.repeat(65) })).toBe(false);
    expect(isLiveItem({ app: 'liveplanner', itemId: '' })).toBe(false);
    // A share code never rides along.
    expect(isLiveItem({ app: 'liveplanner', itemId: 'a', code: 'secret' })).toBe(false);
    expect(isLiveItem(null)).toBe(false);
    expect(isLiveItem(['liveplanner', 'a'])).toBe(false);
    expect(isLiveItem('liveplanner:a')).toBe(false);
    expect(isLiveEmbedApp('livedesign')).toBe(true);
    expect(isLiveEmbedApp('nope')).toBe(false);
  });

  it('keeps a name under the cap', () => {
    expect(isLiveName('Roadmap')).toBe(true);
    expect(isLiveName('x'.repeat(LIVE_NAME_MAX))).toBe(true);
    expect(isLiveName('x'.repeat(LIVE_NAME_MAX + 1))).toBe(false);
    expect(isLiveName(4)).toBe(false);
  });

  it('keeps only a raster data URL under the cap as the poster', () => {
    expect(isLivePoster('data:image/webp;base64,UklGRg==')).toBe(true);
    expect(isLivePoster('data:image/jpeg;base64,/9j/')).toBe(true);
    expect(isLivePoster('data:image/png;base64,iVBO')).toBe(true);
    expect(isLivePoster('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isLivePoster('https://example.com/a.png')).toBe(false);
    expect(isLivePoster('data:image/webp;base64,')).toBe(false);
    expect(isLivePoster('data:image/webp;base64,<script>')).toBe(false);
    expect(isLivePoster(`data:image/webp;base64,${'A'.repeat(LIVE_POSTER_MAX_CHARS)}`)).toBe(false);
    expect(isLivePoster(null)).toBe(false);
  });

  it('checks each field when present, and passes an embed without them', () => {
    expect(firstFieldIssue({ type: 'video' }, LIVE_EMBED_CHECKS)).toBeNull();
    expect(
      firstFieldIssue(
        {
          liveItem: { app: 'livediagram', itemId: 'd1' },
          liveName: 'Architecture',
          livePoster: 'data:image/webp;base64,AA==',
        },
        LIVE_EMBED_CHECKS,
      ),
    ).toBeNull();
    expect(
      firstFieldIssue({ liveItem: { app: 'x', itemId: 'd1' } }, LIVE_EMBED_CHECKS)?.field,
    ).toBe('liveItem');
    expect(firstFieldIssue({ liveName: 7 }, LIVE_EMBED_CHECKS)?.field).toBe('liveName');
    expect(firstFieldIssue({ livePoster: 'data:text/html,hi' }, LIVE_EMBED_CHECKS)?.field).toBe(
      'livePoster',
    );
  });

  it('drops the link for a Community copy and keeps the snapshot', () => {
    const el = {
      id: 'e',
      liveItem: { app: 'liveplanner' as const, itemId: 'p' },
      liveName: 'Plan',
    };
    expect(withoutLiveItem(el)).toEqual({ id: 'e', liveName: 'Plan' });
    const plain = { id: 'f' } as { id: string; liveItem?: unknown };
    expect(withoutLiveItem(plain)).toBe(plain);
  });
});
