import { gzipSync } from 'node:zlib';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HeroOverview } from './hero-overview';
import { HERO_SCENES } from './hero-scenes';

// The overview is the hero's first window, so every scene's settled thumbnail is in the home page's
// static HTML (docs/specs/019-marketing/marketing-site.md "Hero"). The scenes drawn after the real
// templates measure 22.3 KB gzipped together (October 2026); the budget leaves room for small
// changes and fails a scene that grows its markup by a large step, which every visitor would pay for
// on first load.
const OVERVIEW_GZIP_BUDGET = 26 * 1024;

describe('HeroOverview', () => {
  it('keeps every thumbnail inside the home page HTML budget', () => {
    const html = renderToStaticMarkup(
      <HeroOverview
        scenes={HERO_SCENES.map((s) => ({
          key: s.key,
          label: s.short,
          mode: s.mode,
          viewBox: s.landscapeViewBox,
        }))}
        onOpen={() => {}}
      />,
    );
    expect(gzipSync(html, { level: 9 }).length).toBeLessThan(OVERVIEW_GZIP_BUDGET);
  });
});
