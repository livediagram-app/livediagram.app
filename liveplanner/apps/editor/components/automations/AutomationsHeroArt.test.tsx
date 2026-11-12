// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeroBand, HeroTitleMark } from '@liveworkspace/ui/dialog-hero';
import { automationsHeroArt } from './AutomationsHeroArt';

// docs/specs/026-plan/automations.md "The Automations screen": the dialog hero header, drawn for rules.
describe('the Automations hero art', () => {
  it('draws the dots fading toward the title, the corners at every size and the flow only on a wide header', () => {
    const { container } = render(<HeroBand art={automationsHeroArt} />);
    const band = container.querySelector('[data-dialog-hero-art]') as HTMLElement;
    expect(band.getAttribute('data-dialog-hero-art')).toBe('automations');
    expect(band.style.backgroundImage).toMatch(
      /^linear-gradient\(90deg, var\(--hero-paper\).*radial-gradient/,
    );
    const flow = band.querySelector('[data-automations-flow]')!;
    expect(String(flow.getAttribute('class'))).toMatch(/\bhidden\b.*@4xl:block/);
    expect(automationsHeroArt.centre).toBe(true);
    const corners = [...band.children].filter((el) => el !== flow);
    expect(corners).toHaveLength(2);
    for (const el of corners) expect(String(el.getAttribute('class'))).not.toMatch(/\bhidden\b/);
  });

  it('moves once, the bolt’s ring, twice and only where motion is welcome', () => {
    const { container } = render(<HeroBand art={automationsHeroArt} />);
    const moving = container.querySelectorAll('[class*="animate-"]');
    expect(moving).toHaveLength(1);
    expect(String(moving[0]!.getAttribute('class'))).toContain('motion-safe:animate-empty-ring');
    expect(String(moving[0]!.getAttribute('class'))).toContain('[animation-iteration-count:2]');
  });

  it('marks the title with a bolt', () => {
    const { container } = render(<HeroTitleMark art={automationsHeroArt} />);
    const mark = container.querySelector('[data-dialog-hero-mark]')!;
    expect(mark.getAttribute('data-dialog-hero-mark')).toBe('automations');
    expect(mark.querySelectorAll('path')).toHaveLength(1);
  });
});
