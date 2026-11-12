// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HeroBand } from '../HeroDialogHeader';
import type { HeroArt } from '../hero-art';

// liveworkspace/docs/specs/004-index/dialog-hero-header.md "Art": every shared art file, one per modal, is held to the
// same rules, so a new one only has to be dropped in this folder to be checked.
const DIR = import.meta.dirname;
const files = readdirSync(DIR).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'));

const arts = await Promise.all(
  files.map(async (file) => {
    const mod = (await import(`./${file}`)) as Record<string, unknown>;
    const art = Object.values(mod).find(
      (v): v is HeroArt => typeof v === 'object' && v !== null && 'pieces' in v && 'glyph' in v,
    );
    return { file, art, source: readFileSync(join(DIR, file), 'utf8') };
  }),
);

describe.each(arts)('$file', ({ file, art, source }) => {
  it('exports one HeroArt named after its file', () => {
    expect(art, 'a HeroArt export').toBeDefined();
    expect(art!.name).toBe(file.replace(/\.tsx$/, ''));
    expect(art!.glyph).toBeTruthy();
  });

  it('paints only in the tokens, fetches nothing and uses no filter', () => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b(rgb|hsl|oklch)\(/);
    expect(source).not.toMatch(/<image\b|<img\b|url\(|href=/);
    expect(source).not.toMatch(/\bfilter\b|blur\(|drop-shadow/);
  });

  it('moves at most once, only where motion is welcome, two or three times over', () => {
    const { container } = render(<HeroBand art={art!} />);
    const moving = [...container.querySelectorAll('[class*="animate-"]')];
    expect(moving.length).toBeLessThanOrEqual(1);
    for (const el of moving) {
      const cls = String(el.getAttribute('class'));
      expect(cls).toMatch(/motion-safe:animate-/);
      // Important, or the later motion-safe shorthand's `infinite` overrides it and the art never stops.
      expect(cls).toMatch(/\[animation-iteration-count:[23]\]!/);
    }
  });

  it('keeps every piece out of the accessibility tree and its centre piece to wide headers', () => {
    const { container } = render(<HeroBand art={art!} />);
    for (const svg of container.querySelectorAll('[data-dialog-hero-art] > svg')) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
    const centre = container.querySelectorAll('[class*="@4xl:block"]');
    expect(centre.length).toBe(art!.centre ? 1 : 0);
  });
});

it('finds the shared art', () => {
  expect(files).toContain('share.tsx');
});
