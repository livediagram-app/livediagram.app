import { describe, expect, it } from 'vitest';
import { LIVE_EMBED_PAGE_ASPECT, liveEmbedPageSize } from './article-embed-size';

// docs/specs/030-knowledgebase/links-and-embeds.md "Embeds from other apps": a new live embed spans the column.
describe('liveEmbedPageSize', () => {
  it('spans the text column at 4:3', () => {
    expect(LIVE_EMBED_PAGE_ASPECT).toBe(4 / 3);
    expect(liveEmbedPageSize(640)).toEqual({ width: 640, height: 480 });
  });

  it('rounds to whole pixels', () => {
    expect(liveEmbedPageSize(601.6)).toEqual({ width: 602, height: 452 });
  });

  it('is far bigger than the embed default of 480 by 270 in any page column', () => {
    const { width, height } = liveEmbedPageSize(560);
    expect(width).toBeGreaterThan(480);
    expect(height).toBeGreaterThan(270);
  });
});
