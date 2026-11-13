// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeroBand, HeroTitleMark } from '@liveworkspace/ui/dialog-hero';
import { boardConfigureHeroArt } from './BoardConfigureHeroArt';

// docs/specs/026-plan/plan-board.md "Configure": the dialog hero header, drawn as a board being set up.
describe('the Configure Board hero art', () => {
  it('draws the grid fading toward the title and its corner, with no centre piece', () => {
    const { container } = render(<HeroBand art={boardConfigureHeroArt} />);
    const band = container.querySelector('[data-dialog-hero-art]') as HTMLElement;
    expect(band.getAttribute('data-dialog-hero-art')).toBe('board-configure');
    expect(band.style.backgroundImage).toMatch(/^linear-gradient\(90deg, var\(--hero-paper\)/);
    const pieces = [...band.children];
    // One corner, on the right: the title's side stays plain paper.
    expect(pieces).toHaveLength(1);
    for (const el of pieces) expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('[class*="@4xl:block"]')).toBeNull();
  });

  it('moves once, the dragged column bobbing twice, only where motion is welcome', () => {
    const { container } = render(<HeroBand art={boardConfigureHeroArt} />);
    const moving = container.querySelectorAll('[class*="animate-"]');
    expect(moving).toHaveLength(1);
    expect(String(moving[0]!.getAttribute('class'))).toContain('motion-safe:animate-empty-float');
    expect(String(moving[0]!.getAttribute('class'))).toContain('[animation-iteration-count:2]');
  });

  it('paints only in the tokens and marks the title with a board’s columns', () => {
    const source = readFileSync(join(import.meta.dirname, 'BoardConfigureHeroArt.tsx'), 'utf8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgb|hsl|oklch)\(|url\(|\bfilter\b/);
    const { container } = render(<HeroTitleMark art={boardConfigureHeroArt} />);
    expect(container.querySelectorAll('rect')).toHaveLength(3);
  });
});
