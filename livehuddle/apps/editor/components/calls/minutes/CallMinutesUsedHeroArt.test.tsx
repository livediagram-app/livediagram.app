// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeroBand } from '@liveworkspace/ui/dialog-hero';
import { callMinutesUsedHeroArt } from './CallMinutesUsedHeroArt';

// The dialog hero header's art rules (liveworkspace/docs/specs/004-index/dialog-hero-header.md "Art"), held for this
// product's own art as the shared folder's test holds its files.
const source = readFileSync(join(import.meta.dirname, 'CallMinutesUsedHeroArt.tsx'), 'utf8');

describe('callMinutesUsedHeroArt', () => {
  it('is named for its dialog and paints only in the tokens, with no image or filter', () => {
    expect(callMinutesUsedHeroArt.name).toBe('call-minutes-used');
    expect(callMinutesUsedHeroArt.glyph).toBeTruthy();
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b(rgb|hsl|oklch)\(/);
    expect(source).not.toMatch(/<image\b|<img\b|url\(|href=/);
    expect(source).not.toMatch(/\bfilter\b|blur\(|drop-shadow/);
  });

  it('moves once, where motion is welcome, twice over; its pieces hidden and off a phone', () => {
    const { container } = render(<HeroBand art={callMinutesUsedHeroArt} />);
    const moving = [...container.querySelectorAll('[class*="animate-"]')];
    expect(moving).toHaveLength(1);
    expect(moving[0]!.getAttribute('class')).toMatch(
      /motion-safe:animate-.*\[animation-iteration-count:2\]!/,
    );
    for (const svg of container.querySelectorAll('[data-dialog-hero-art] > svg')) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('class')).toContain('max-sm:hidden');
    }
    expect(container.querySelector('[class*="@4xl:block"]')).toBeNull();
  });
});
