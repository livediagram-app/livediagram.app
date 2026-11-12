// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeroBand } from '@liveworkspace/ui/dialog-hero';
import { layoutGalleryHeroArt } from './LayoutGalleryHeroArt';

// docs/specs/007-editor/pages-mode.md "An empty page offers its layouts": Choose a Layout's dialog wears the dialog
// hero header, drawn as the gallery.
describe('the layout gallery hero art', () => {
  it('draws the corners at every size and the tiled frames only on a wide header', () => {
    const { container } = render(<HeroBand art={layoutGalleryHeroArt} />);
    const band = container.querySelector('[data-dialog-hero-art]') as HTMLElement;
    expect(band.getAttribute('data-dialog-hero-art')).toBe('layout-gallery');
    const tiles = band.querySelector('[data-layout-gallery-tiles]')!;
    expect(String(tiles.getAttribute('class'))).toMatch(/\bhidden\b.*@4xl:block/);
    expect(layoutGalleryHeroArt.centre).toBe(true);
    // Six frames, the chosen one with its eight handles.
    expect(tiles.querySelectorAll('rect[rx="4"]')).toHaveLength(6);
    expect(tiles.querySelectorAll('rect[rx="1"]')).toHaveLength(8);
    const corners = [...band.children].filter((el) => el !== tiles);
    expect(corners).toHaveLength(2);
    for (const el of band.children) expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('moves once, the chosen frame bobbing twice, only where motion is welcome', () => {
    const { container } = render(<HeroBand art={layoutGalleryHeroArt} />);
    const moving = container.querySelectorAll('[class*="animate-"]');
    expect(moving).toHaveLength(1);
    expect(String(moving[0]!.getAttribute('class'))).toMatch(
      /motion-safe:animate-empty-float.*\[animation-iteration-count:2\]/,
    );
  });

  it('paints only in the tokens', () => {
    const source = readFileSync(join(import.meta.dirname, 'LayoutGalleryHeroArt.tsx'), 'utf8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgb|hsl|oklch)\(|url\(|\bfilter\b/);
  });
});
