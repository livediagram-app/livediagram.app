// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeroBand, HeroTitleMark } from '@liveworkspace/ui/dialog-hero';
import { siteSettingsHeroArt } from './SiteSettingsHeroArt';

// liveworkspace/docs/specs/010-site/site.md "Settings": the dialog hero header, drawn for one account and every app.
const SOURCE = readFileSync(join(import.meta.dirname, 'SiteSettingsHeroArt.tsx'), 'utf8');

describe('the site Settings hero art', () => {
  it('draws the grid, its corner from sm and the hub only on a wide header', () => {
    const { container } = render(<HeroBand art={siteSettingsHeroArt} />);
    const band = container.querySelector('[data-dialog-hero-art]') as HTMLElement;
    expect(band.getAttribute('data-dialog-hero-art')).toBe('site-settings');
    expect(band.style.backgroundImage).toMatch(/^linear-gradient\(90deg, var\(--hero-paper\)/);
    const hub = band.querySelector('[data-site-settings-hub]')!;
    expect(String(hub.getAttribute('class'))).toMatch(/\bhidden\b.*@4xl:block/);
    expect(siteSettingsHeroArt.centre).toBe(true);
    const corners = [...band.children].filter((el) => el !== hub);
    // One corner, on the right: the title's side stays plain paper.
    expect(corners).toHaveLength(1);
    for (const el of corners) {
      expect(el.getAttribute('aria-hidden')).toBe('true');
      expect(String(el.getAttribute('class'))).toContain('max-sm:hidden');
    }
  });

  it('moves once, the account’s ring, twice and only where motion is welcome', () => {
    const { container } = render(<HeroBand art={siteSettingsHeroArt} />);
    const moving = container.querySelectorAll('[class*="animate-"]');
    expect(moving).toHaveLength(1);
    expect(String(moving[0]!.getAttribute('class'))).toContain('motion-safe:animate-empty-ring');
    expect(String(moving[0]!.getAttribute('class'))).toContain('[animation-iteration-count:2]');
  });

  it('paints only in the tokens and fetches nothing', () => {
    expect(SOURCE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(SOURCE).not.toMatch(/\b(rgb|hsl|oklch)\(/);
    expect(SOURCE).not.toMatch(/<image\b|<img\b|url\(|href=/);
    expect(SOURCE).not.toMatch(/\bfilter\b|blur\(|drop-shadow/);
  });

  it('marks the title with the Settings cog', () => {
    const { container } = render(<HeroTitleMark art={siteSettingsHeroArt} />);
    const mark = container.querySelector('[data-dialog-hero-mark]')!;
    expect(mark.getAttribute('data-dialog-hero-mark')).toBe('site-settings');
    expect(mark.querySelector('path')!.getAttribute('fill-rule')).toBe('evenodd');
  });
});
