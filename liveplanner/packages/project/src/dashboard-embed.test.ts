import { describe, expect, it } from 'vitest';
import { dashboardEmbedOf, readDashboardEmbed } from './dashboard-embed';
import { readDashboard } from './dashboard';

// docs/specs/013-workspace/embeds.md "Embed File on a Dashboard": the slot keeps the file's link, name and snapshot,
// read safely; a field that fails its guard is dropped, never the slot.
const POSTER = 'data:image/webp;base64,UklGRg==';
const ITEM = { app: 'livediagram', itemId: 'd1' } as const;

describe('an Embed File on a Dashboard', () => {
  it('reads an empty one', () => {
    expect(readDashboardEmbed({ type: 'embed' })).toEqual({ type: 'embed' });
  });

  it('reads a chosen one whole', () => {
    expect(
      readDashboardEmbed({ type: 'embed', liveItem: ITEM, liveName: 'Flow', livePoster: POSTER }),
    ).toEqual({ type: 'embed', liveItem: ITEM, liveName: 'Flow', livePoster: POSTER });
  });

  it('drops fields that fail their guard, keeping the slot', () => {
    expect(
      readDashboardEmbed({
        type: 'embed',
        liveItem: { app: 'livehuddle', itemId: 'x' },
        liveName: 7,
        livePoster: 'javascript:alert(1)',
      }),
    ).toEqual({ type: 'embed' });
  });

  it('is not read for another kind of content', () => {
    expect(readDashboardEmbed({ type: 'note' })).toBeUndefined();
  });

  it('makes the content from a choice, with or without a snapshot', () => {
    expect(dashboardEmbedOf({ liveItem: ITEM, liveName: 'Flow', livePoster: POSTER })).toEqual({
      type: 'embed',
      liveItem: ITEM,
      liveName: 'Flow',
      livePoster: POSTER,
    });
    expect(dashboardEmbedOf({ liveItem: ITEM, liveName: 'Flow' })).toEqual({
      type: 'embed',
      liveItem: ITEM,
      liveName: 'Flow',
    });
  });

  it('survives reading a stored dashboard', () => {
    const layout = readDashboard({
      rows: [
        {
          id: 'r1',
          height: 320,
          slots: [
            { id: 's1', span: 12, content: { type: 'embed', liveItem: ITEM, liveName: 'Flow' } },
          ],
        },
      ],
    });
    expect(layout?.rows[0]?.slots[0]?.content).toEqual({
      type: 'embed',
      liveItem: ITEM,
      liveName: 'Flow',
    });
  });
});
