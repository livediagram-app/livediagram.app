// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeroBand } from '@liveworkspace/ui/dialog-hero';
import { setupBoardHeroArt, setupSheetHeroArt } from './SetupHeroArt';

// docs/specs/026-plan/plan-board.md "Setup Board" and docs/specs/029-sheets/sheet.md "Setup Sheet": the dialog hero
// header, the board's as the Start screen's lanes, the sheet's as cells.
describe('the setup dialogs’ hero art', () => {
  it('draws Setup Board as four lanes and a card mid-drag, bobbing twice', () => {
    const { container } = render(<HeroBand art={setupBoardHeroArt} />);
    const band = container.querySelector('[data-dialog-hero-art]') as HTMLElement;
    expect(band.getAttribute('data-dialog-hero-art')).toBe('setup-board');
    expect(band.querySelectorAll(':scope > div > span')).toHaveLength(4);
    const moving = container.querySelectorAll('[class*="animate-"]');
    expect(moving).toHaveLength(1);
    expect(String(moving[0]!.getAttribute('class'))).toMatch(
      /motion-safe:animate-empty-float.*\[animation-iteration-count:2\]/,
    );
  });

  it('draws Setup Sheet as a grid of cells, one ringed, its ring spreading twice', () => {
    const { container } = render(<HeroBand art={setupSheetHeroArt} />);
    const band = container.querySelector('[data-dialog-hero-art]') as HTMLElement;
    expect(band.getAttribute('data-dialog-hero-art')).toBe('setup-sheet');
    expect(band.style.backgroundImage).toMatch(/^linear-gradient\(90deg, var\(--hero-paper\)/);
    const moving = container.querySelectorAll('[class*="animate-"]');
    expect(moving).toHaveLength(1);
    expect(String(moving[0]!.getAttribute('class'))).toContain('motion-safe:animate-empty-ring');
  });

  it('keeps both to the tokens and hidden; only the sheet has a centre piece, for a wide header', () => {
    const source = readFileSync(join(import.meta.dirname, 'SetupHeroArt.tsx'), 'utf8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgb|hsl|oklch)\(|url\(|\bfilter\b/);
    for (const art of [setupBoardHeroArt, setupSheetHeroArt]) {
      const { container, unmount } = render(<HeroBand art={art} />);
      for (const svg of container.querySelectorAll('svg')) {
        expect(svg.getAttribute('aria-hidden')).toBe('true');
      }
      const centre = container.querySelectorAll('[class*="@4xl:block"]');
      expect(centre).toHaveLength(art.centre ? 1 : 0);
      unmount();
    }
    expect(setupBoardHeroArt.centre).toBeFalsy();
    expect(setupSheetHeroArt.centre).toBe(true);
  });
});
