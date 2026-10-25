import { describe, expect, it } from 'vitest';
import { liveImageUrlFor } from './live-image';

describe('live-image builders (docs/specs/013-workspace/live-image-share.md + docs/specs/006-document/document-snapshots.md)', () => {
  const origin = 'https://live.test';

  it('builds the same-origin /api share-image URL', () => {
    expect(liveImageUrlFor(origin, 'ABC123')).toBe('https://live.test/api/share/ABC123/image.svg');
  });

  it('url-encodes the share code', () => {
    expect(liveImageUrlFor(origin, 'a/b?c')).toBe(
      'https://live.test/api/share/a%2Fb%3Fc/image.svg',
    );
  });

  it('appends ?tab= (encoded) when a tab id is supplied', () => {
    expect(liveImageUrlFor(origin, 'ABC123', 'tab/9')).toBe(
      'https://live.test/api/share/ABC123/image.svg?tab=tab%2F9',
    );
  });

  it('omits ?tab= when the tab id is undefined (default first tab)', () => {
    expect(liveImageUrlFor(origin, 'ABC123', undefined)).toBe(
      'https://live.test/api/share/ABC123/image.svg',
    );
  });
});
