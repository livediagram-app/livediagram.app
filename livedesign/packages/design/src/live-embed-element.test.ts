// A live embed's stored fields (liveworkspace/docs/specs/004-index/live-embeds.md "Security", "Snapshots"): the link
// and snapshot checked on every element, and an export drawing the snapshot, never the file.
import { describe, expect, it } from 'vitest';
import { createVideo } from './factories';
import { describeBoxedExport } from './svg-render-describe';
import { elementValidationIssue } from './validate';
import { isElementFieldName } from './element-fields';

const POSTER = 'data:image/webp;base64,UklGRg==';
const live = (over: Record<string, unknown> = {}) => ({
  ...createVideo(0, 0, 'live'),
  liveItem: { app: 'liveplanner', itemId: 'p1' },
  liveName: 'Roadmap',
  livePoster: POSTER,
  ...over,
});

describe('a live embed element', () => {
  it('stores its link and snapshot', () => {
    for (const field of ['liveItem', 'liveName', 'livePoster'])
      expect(isElementFieldName('video', field)).toBe(true);
    expect(elementValidationIssue(live())).toBeNull();
    expect(elementValidationIssue(createVideo(0, 0, 'live'))).toBeNull();
  });

  it('refuses a link with a share code, another app, a long name or a picture that is not a raster', () => {
    expect(
      elementValidationIssue(live({ liveItem: { app: 'liveplanner', itemId: 'p1', code: 'x' } }))
        ?.field,
    ).toBe('liveItem');
    expect(
      elementValidationIssue(live({ liveItem: { app: 'livehuddle', itemId: 'p1' } }))?.field,
    ).toBe('liveItem');
    expect(elementValidationIssue(live({ liveName: 'x'.repeat(201) }))?.field).toBe('liveName');
    expect(
      elementValidationIssue(live({ livePoster: 'data:image/svg+xml;base64,PHN2Zz4=' }))?.field,
    ).toBe('livePoster');
  });

  it('exports as its snapshot picture, or its plain card without one', () => {
    expect(describeBoxedExport(live() as never).shape).toMatchObject({
      kind: 'image',
      href: POSTER,
    });
    const plain = describeBoxedExport(live({ livePoster: undefined }) as never).shape;
    expect(plain).not.toMatchObject({ kind: 'image', href: POSTER });
  });
});
