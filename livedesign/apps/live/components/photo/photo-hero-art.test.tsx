// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HeroBand, HeroTitleMark, type HeroArt } from '@liveworkspace/ui/dialog-hero';
import { makeSizesHeroArt } from './MakeSizesHeroArt';
import { photoAdjustHeroArt } from './PhotoAdjustHeroArt';
import { photoCanvasSizeHeroArt } from './PhotoCanvasSizeHeroArt';
import { photoFillHeroArt } from './PhotoFillHeroArt';
import { photoFilterHeroArt } from './PhotoFilterHeroArt';
import { photoFlattenHeroArt } from './PhotoFlattenHeroArt';
import { photoImageSizeHeroArt } from './PhotoImageSizeHeroArt';
import { photoRotateHeroArt } from './PhotoRotateHeroArt';
import { photoSelectionHeroArt } from './PhotoSelectionHeroArt';
import { selectAndMaskHeroArt } from './SelectAndMaskHeroArt';

// liveworkspace/docs/specs/004-index/dialog-hero-header.md "Art": the photo dialogs' hero art, each held to the
// art rules.
const ARTS: [file: string, art: HeroArt][] = [
  ['MakeSizesHeroArt', makeSizesHeroArt],
  ['PhotoAdjustHeroArt', photoAdjustHeroArt],
  ['PhotoCanvasSizeHeroArt', photoCanvasSizeHeroArt],
  ['PhotoFillHeroArt', photoFillHeroArt],
  ['PhotoFilterHeroArt', photoFilterHeroArt],
  ['PhotoFlattenHeroArt', photoFlattenHeroArt],
  ['PhotoImageSizeHeroArt', photoImageSizeHeroArt],
  ['PhotoRotateHeroArt', photoRotateHeroArt],
  ['PhotoSelectionHeroArt', photoSelectionHeroArt],
  ['SelectAndMaskHeroArt', selectAndMaskHeroArt],
];

afterEach(cleanup);

describe('the photo dialogs’ hero art', () => {
  it('is named once each', () => {
    expect(new Set(ARTS.map(([, art]) => art.name)).size).toBe(ARTS.length);
  });

  it.each(ARTS)('%s draws a texture and one corner piece, at most 96 x 30', (_file, art) => {
    const { container } = render(<HeroBand art={art} />);
    const band = container.querySelector('[data-dialog-hero-art]') as HTMLElement;
    expect(band.getAttribute('data-dialog-hero-art')).toBe(art.name);
    expect(art.texture?.backgroundImage).toBeTruthy();
    expect(art.centre).toBeUndefined();
    // One corner, on the right, from sm: the title's side stays plain paper.
    expect(band.children).toHaveLength(1);
    const corner = band.children[0]!;
    expect(corner.getAttribute('aria-hidden')).toBe('true');
    expect(String(corner.getAttribute('class'))).toMatch(
      /\bbottom-0\b.*\bright-3\b.*max-sm:hidden/,
    );
    expect(Number(corner.getAttribute('width'))).toBeLessThanOrEqual(96);
    expect(Number(corner.getAttribute('height'))).toBeLessThanOrEqual(30);
  });

  it.each(ARTS)('%s moves once at most, twice over, only where motion is welcome', (_file, art) => {
    const { container } = render(<HeroBand art={art} />);
    const moving = container.querySelectorAll('[class*="animate-"]');
    expect(moving.length).toBeLessThanOrEqual(1);
    for (const el of moving)
      expect(String(el.getAttribute('class'))).toMatch(
        /motion-safe:animate-empty-(ring|float).*\[animation-iteration-count:2\]/,
      );
  });

  it.each(ARTS)('%s has a glyph for the title mark', (_file, art) => {
    const { container } = render(<HeroTitleMark art={art} />);
    expect(container.querySelector('svg')!.children.length).toBeGreaterThan(0);
  });

  it.each([...ARTS.map(([file]) => file), 'photo-hero-shot'])(
    '%s paints only in the tokens',
    (file) => {
      const source = readFileSync(join(import.meta.dirname, `${file}.tsx`), 'utf8');
      expect(source).not.toMatch(
        /#[0-9a-fA-F]{3,8}\b|\b(rgb|hsl|oklch)\(|url\(|<filter\b|\bfilter[=:]|<image\b|<img\b/,
      );
      // Every colour is a hero token.
      for (const [, colour] of source.matchAll(/\b(?:fill|stroke)="([^"]+)"/g))
        expect(colour).toMatch(/^(none|var\(--hero-[a-z]+\))$/);
    },
  );
});
