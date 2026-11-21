import { describe, expect, it } from 'vitest';
import {
  PAGE_GRADIENT_PRESETS,
  coverOfGradient,
  gradientNameOf,
  pageCoverOf,
  parseTabCover,
  withSettledCover,
} from './page-cover';
import { migrateStoredTab } from './stored-tab';

// docs/specs/030-knowledgebase/page-surface.md "The cover".
describe('a page’s cover', () => {
  it('names a picture by a gallery id or an inline raster, nothing else', () => {
    expect(parseTabCover({ imageId: 'img_abc', focus: 30 })).toEqual({
      imageId: 'img_abc',
      focus: 30,
    });
    expect(parseTabCover({ imageId: 'data:image/png;base64,AAAA' })?.imageId).toMatch(
      /^data:image/,
    );
    expect(parseTabCover({ imageId: 'javascript:alert(1)' })).toBeUndefined();
    expect(parseTabCover({ imageId: 'https://example.com/a.png' })).toBeUndefined();
  });

  it('offers every gradient by its name, in any case, and reads a gradient back by name', () => {
    for (const preset of PAGE_GRADIENT_PRESETS) {
      const cover = coverOfGradient(preset.label.toUpperCase());
      expect(cover?.fill).toMatchObject({ kind: 'gradient', from: preset.from, to: preset.to });
      expect(gradientNameOf(cover)).toBe(preset.label);
    }
    expect(coverOfGradient('Plaid')).toBeUndefined();
    expect(
      gradientNameOf({ fill: { kind: 'gradient', from: '#123456', to: '#654321', angle: 0 } }),
    ).toBeUndefined();
    expect(gradientNameOf({ imageId: 'img_a' })).toBeUndefined();
    expect(gradientNameOf(undefined)).toBeUndefined();
  });

  it('shows no pattern: a pattern is a form’s', () => {
    expect(pageCoverOf({ pattern: 'dots' })).toBeUndefined();
    expect(pageCoverOf({ imageId: 'img_a', pattern: 'grid' })).toEqual({ imageId: 'img_a' });
  });

  it('settles a stored tab’s cover, the same tab when there is nothing to settle', () => {
    const plain = { id: 't', name: 'P', elements: [] };
    expect(withSettledCover(plain)).toBe(plain);
    const good = { ...plain, cover: { imageId: 'img_a' } };
    expect(withSettledCover(good)).toBe(good);
    expect(withSettledCover({ ...plain, cover: { imageId: 'img_a', focus: 900 } })).toEqual({
      ...plain,
      cover: { imageId: 'img_a' },
    });
    expect('cover' in withSettledCover({ ...plain, cover: 'sunset' })).toBe(false);
  });

  it('is settled by the migrations every read takes', () => {
    const tab = migrateStoredTab({
      id: 't',
      name: 'P',
      elements: [],
      cover: { imageId: 'img_a', focus: -4, credit: 7 },
    } as never) as { cover?: unknown };
    expect(tab.cover).toEqual({ imageId: 'img_a' });
  });
});
