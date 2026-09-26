import { describe, expect, it } from 'vitest';
import { liveImageHtml, liveImageMarkdown, liveImageUrlFor } from './live-image';

describe('live-image builders (docs/specs/013-workspace/live-image-share.md + docs/specs/006-diagram/diagram-snapshots.md)', () => {
  const origin = 'https://livediagram.app';

  it('builds the same-origin /api share-image URL', () => {
    expect(liveImageUrlFor(origin, 'ABC123')).toBe(
      'https://livediagram.app/api/share/ABC123/image.svg',
    );
  });

  it('url-encodes the share code', () => {
    expect(liveImageUrlFor(origin, 'a/b?c')).toBe(
      'https://livediagram.app/api/share/a%2Fb%3Fc/image.svg',
    );
  });

  it('appends ?tab= (encoded) when a tab id is supplied', () => {
    expect(liveImageUrlFor(origin, 'ABC123', 'tab/9')).toBe(
      'https://livediagram.app/api/share/ABC123/image.svg?tab=tab%2F9',
    );
  });

  it('omits ?tab= when the tab id is undefined (default first tab)', () => {
    expect(liveImageUrlFor(origin, 'ABC123', undefined)).toBe(
      'https://livediagram.app/api/share/ABC123/image.svg',
    );
  });

  it('threads the tab id through the Markdown + HTML wrappers', () => {
    expect(liveImageMarkdown(origin, 'C', 't2')).toBe(
      '![diagram](https://livediagram.app/api/share/C/image.svg?tab=t2)',
    );
    expect(liveImageHtml(origin, 'C', 't2')).toBe(
      '<img src="https://livediagram.app/api/share/C/image.svg?tab=t2" alt="diagram" />',
    );
  });

  it('wraps the URL in Markdown image syntax', () => {
    expect(liveImageMarkdown(origin, 'C')).toBe(
      '![diagram](https://livediagram.app/api/share/C/image.svg)',
    );
  });

  it('wraps the URL in an HTML <img>', () => {
    expect(liveImageHtml(origin, 'C')).toBe(
      '<img src="https://livediagram.app/api/share/C/image.svg" alt="diagram" />',
    );
  });
});
