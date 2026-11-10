import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The heroes' paint (liveworkspace/docs/specs/010-site/site.md "The front door", Paint): their glows are radial
// gradients, never a CSS `filter` blur, and nothing over them takes a `backdrop-filter`. iPad Safari re-rasterises a
// large blur, and the backdrop layers sampling it, when it repaints under a touch (a long press, a press-and-drag
// scroll), and the front door's colours broke there.
const HEROES = [
  'components/landing/HubArt.tsx',
  'components/landing/HeroActions.tsx',
  'components/LegalPage.tsx',
  'app/page.tsx',
];

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

// A Tailwind blur or backdrop-blur utility (`blur`, `blur-3xl`, `backdrop-blur-md`, `blur-[2px]`), or a blur() in an
// inline style or arbitrary value. Comments are dropped first, so prose saying why is fine.
const BLUR = /(?<![\w-])(?:backdrop-)?blur(?:-[^\s'"`]+)?(?=[\s'"`])|blur\(/g;

describe('hero paint', () => {
  it.each(HEROES)('%s blurs nothing, by filter or by backdrop', (path) => {
    const code = read(path)
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('{/*'))
      .join('\n');
    expect(code.match(BLUR) ?? []).toEqual([]);
  });

  it('draws the front door and legal glows as gradients, marked as the glow layer', () => {
    const hub = read('components/landing/HubArt.tsx');
    expect(hub).toMatch(/data-hero-glow/);
    expect(hub).toMatch(/const GLOW = '[^']*bg-radial-\[closest-side\][^']*to-transparent/);
    const legal = read('components/LegalPage.tsx');
    expect(legal).toMatch(/data-hero-glow/);
    expect(legal).toMatch(/radial-gradient\(closest-side, \$\{app\.accent\}, transparent\)/);
  });
});
