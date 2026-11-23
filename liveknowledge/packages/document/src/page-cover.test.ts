import { describe, expect, it } from 'vitest';
import {
  COVER_GRADIENT_IDS,
  coverFill,
  coverGradientLabel,
  coverImageId,
  coverKindOf,
  coverThemeFrom,
  parseTabCover,
  withSettledCover,
} from './page-cover';
import { migrateStoredTab } from './stored-tab';
import { themeBackgroundPresets } from './page-theme-fills';

// docs/specs/030-knowledgebase/page-surface.md "The cover".
const OCEAN = { elementStroke: '#0369a1' };
const EMBER = { elementStroke: '#b91c1c' };

describe('a page’s cover', () => {
  it('names a picture by a gallery id or an inline raster, nothing else', () => {
    expect(parseTabCover({ imageId: 'img_abc', focus: 30, credit: ' By A ' })).toEqual({
      imageId: 'img_abc',
      focus: 30,
      credit: 'By A',
    });
    expect(parseTabCover({ imageId: 'data:image/png;base64,AAAA' })).toMatchObject({
      imageId: expect.stringMatching(/^data:image/),
    });
    expect(parseTabCover({ imageId: 'javascript:alert(1)' })).toBeUndefined();
    expect(parseTabCover({ imageId: 'https://example.com/a.png' })).toBeUndefined();
  });

  it('keeps a theme gradient and an animated background by role, never colours', () => {
    expect(COVER_GRADIENT_IDS).toHaveLength(14);
    expect(parseTabCover({ gradient: 'theme-dawn' })).toEqual({ gradient: 'theme-dawn' });
    expect(parseTabCover({ gradient: 'Sunrise' })).toBeUndefined();
    expect(
      parseTabCover({ fill: { kind: 'gradient', from: '#fff', to: '#000', angle: 1 } }),
    ).toBeUndefined();
    expect(parseTabCover({ motion: 'aurora', colouring: 'deep', speed: 2 })).toEqual({
      motion: 'aurora',
      colouring: 'deep',
      speed: 2,
    });
    // A speed of 1, or out of range, is left off; a motion needs a colouring.
    expect(parseTabCover({ motion: 'aurora', colouring: 'deep', speed: 1 })).toEqual({
      motion: 'aurora',
      colouring: 'deep',
    });
    expect(parseTabCover({ motion: 'aurora', colouring: 'deep', speed: 9 })).toEqual({
      motion: 'aurora',
      colouring: 'deep',
    });
    expect(parseTabCover({ motion: 'aurora' })).toBeUndefined();
    expect(parseTabCover({ motion: 'twirl', colouring: 'deep' })).toBeUndefined();
    // A picture wins over a gradient.
    expect(parseTabCover({ imageId: 'img_a', gradient: 'theme-ink' })).toEqual({
      imageId: 'img_a',
    });
    expect(parseTabCover('sunset')).toBeUndefined();
  });

  it('says its kind', () => {
    expect(coverKindOf({ imageId: 'img_a' })).toBe('image');
    expect(coverKindOf({ gradient: 'theme-ink' })).toBe('gradient');
    expect(coverKindOf({ motion: 'waves', colouring: 'soft' })).toBe('animated');
    expect(coverImageId({ imageId: 'img_a' })).toBe('img_a');
    expect(coverImageId({ gradient: 'theme-ink' })).toBeUndefined();
    expect(coverImageId(undefined)).toBeUndefined();
  });

  it('paints in the knowledgebase’s theme, so a change of style recolours it', () => {
    const cover = { gradient: 'theme-bright' } as const;
    expect(coverFill(cover, OCEAN)).toEqual(
      themeBackgroundPresets(OCEAN).find((p) => p.id === 'theme-bright')!.fill,
    );
    expect(coverFill(cover, OCEAN)).not.toEqual(coverFill(cover, EMBER));
    const moving = coverFill({ motion: 'aurora', colouring: 'deep', speed: 2 }, OCEAN);
    expect(moving).toMatchObject({ kind: 'gradient', motion: 'aurora', speed: 2 });
    expect(coverFill({ motion: 'aurora', colouring: 'deep' }, EMBER)).not.toEqual(
      coverFill({ motion: 'aurora', colouring: 'deep' }, OCEAN),
    );
    expect(coverFill({ imageId: 'img_a' }, OCEAN)).toBeUndefined();
    expect(coverGradientLabel('theme-twilight')).toBe('Theme Twilight');
  });

  it('leads its theme’s palette with the writing accent (coverThemeFrom)', () => {
    const palette = [
      { fill: '#eff6ff', stroke: '#2563eb', text: '#1e3a8a' },
      { fill: '#fdf2f8', stroke: '#db2777', text: '#831843' },
    ];
    expect(coverThemeFrom({ palette }, '#7c3aed')).toEqual({
      elementStroke: '#7c3aed',
      palette: [{ ...palette[0], stroke: '#7c3aed' }, palette[1]],
    });
    expect(coverThemeFrom({}, '#7c3aed')).toEqual({
      elementStroke: '#7c3aed',
      palette: [{ fill: '', text: '', stroke: '#7c3aed' }],
    });
  });

  it('settles a stored tab’s cover, the same tab when there is nothing to settle', () => {
    const plain = { id: 't', name: 'P', elements: [] };
    expect(withSettledCover(plain)).toBe(plain);
    const good = { ...plain, cover: { gradient: 'theme-ink' } };
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
