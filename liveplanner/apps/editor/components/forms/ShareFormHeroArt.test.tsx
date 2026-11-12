// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeroBand, HeroTitleMark } from '@liveworkspace/ui/dialog-hero';
import { shareFormHeroArt } from './ShareFormHeroArt';

// docs/specs/030-forms/forms.md "Publishing and the form link": the dialog hero header, the form handed out.
describe('the Share Form hero art', () => {
  it('spreads rings from the corner where the link reaches its two people, the form in the other', () => {
    const { container } = render(<HeroBand art={shareFormHeroArt} />);
    const band = container.querySelector('[data-dialog-hero-art]') as HTMLElement;
    expect(band.getAttribute('data-dialog-hero-art')).toBe('share-form');
    expect(band.style.backgroundImage).toMatch(/radial-gradient/);
    const svgs = band.querySelectorAll(':scope > svg');
    expect(svgs).toHaveLength(2);
    for (const svg of svgs) expect(svg.getAttribute('aria-hidden')).toBe('true');
    // The line along the foot leaves a phone's compact band, as the corners do.
    expect(String(band.querySelector(':scope > span')!.getAttribute('class'))).toContain(
      'max-sm:hidden',
    );
  });

  it('moves once, the link’s ring, twice and only where motion is welcome', () => {
    const { container } = render(<HeroBand art={shareFormHeroArt} />);
    const moving = container.querySelectorAll('[class*="animate-"]');
    expect(moving).toHaveLength(1);
    expect(String(moving[0]!.getAttribute('class'))).toMatch(
      /motion-safe:animate-empty-ring.*\[animation-iteration-count:2\]/,
    );
  });

  it('paints only in the tokens and marks the title with a form', () => {
    const source = readFileSync(join(import.meta.dirname, 'ShareFormHeroArt.tsx'), 'utf8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgb|hsl|oklch)\(|url\(|\bfilter\b/);
    const { container } = render(<HeroTitleMark art={shareFormHeroArt} />);
    const mark = container.querySelector('[data-dialog-hero-mark]')!;
    expect(mark.getAttribute('data-dialog-hero-mark')).toBe('share-form');
  });
});
