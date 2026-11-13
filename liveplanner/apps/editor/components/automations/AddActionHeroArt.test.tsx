// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeroBand, HeroTitleMark } from '@liveworkspace/ui/dialog-hero';
import { addActionHeroArt } from './AddActionHeroArt';

// docs/specs/026-plan/automations.md "The rule builder": the Add an Action picker wears the dialog hero header.
describe('the Add an Action hero art', () => {
  it('draws the dots fading toward the title, its corner from `sm` and the hand only on a wide header', () => {
    const { container } = render(<HeroBand art={addActionHeroArt} />);
    const band = container.querySelector('[data-dialog-hero-art]') as HTMLElement;
    expect(band.getAttribute('data-dialog-hero-art')).toBe('add-action');
    expect(band.style.backgroundImage).toMatch(
      /^linear-gradient\(90deg, var\(--hero-paper\).*radial-gradient/,
    );
    const hand = band.querySelector('[data-actions-hand]')!;
    expect(String(hand.getAttribute('class'))).toMatch(/\bhidden\b.*@4xl:block/);
    expect(addActionHeroArt.centre).toBe(true);
    const corners = [...band.children].filter((el) => el !== hand);
    // One corner, on the right: the title's side stays plain paper.
    expect(corners).toHaveLength(1);
    for (const el of corners) {
      const cls = String(el.getAttribute('class'));
      expect(cls).toContain('max-sm:hidden');
      expect(cls).not.toMatch(/(^|\s)hidden\b/);
      expect(el.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('moves once, the plus’s ring, twice and only where motion is welcome', () => {
    const { container } = render(<HeroBand art={addActionHeroArt} />);
    const moving = container.querySelectorAll('[class*="animate-"]');
    expect(moving).toHaveLength(1);
    const cls = String(moving[0]!.getAttribute('class'));
    expect(cls).toContain('motion-safe:animate-empty-ring');
    expect(cls).toContain('[animation-iteration-count:2]!');
  });

  it('paints only in the tokens and marks the title with a card and a plus', () => {
    const source = readFileSync(join(import.meta.dirname, 'AddActionHeroArt.tsx'), 'utf8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgb|hsl|oklch)\(|\bfilter\b/);
    const { container } = render(<HeroTitleMark art={addActionHeroArt} />);
    const mark = container.querySelector('[data-dialog-hero-mark]')!;
    expect(mark.getAttribute('data-dialog-hero-mark')).toBe('add-action');
    expect(mark.querySelectorAll('rect')).toHaveLength(1);
  });
});
