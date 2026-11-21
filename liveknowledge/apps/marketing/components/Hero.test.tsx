import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { HERO_HEADLINE, HERO_LEAD } from '@/lib/site-words';
import { Hero } from './Hero';
import { HeroIllustration } from './HeroIllustration';

// docs/specs/019-marketing/marketing-site.md "Hero".
describe('the hero', () => {
  const html = renderToStaticMarkup(<Hero />);
  const text = (fragment: string) => fragment.replace(/<[^>]+>/g, '');

  it('says what liveknowledge is, in one h1 and one lead sentence', () => {
    const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(text(h1![1]!)).toBe(HERO_HEADLINE);
    expect(html).toContain(HERO_LEAD);
  });

  it('offers the two ways in: start (the funnel’s Home.Hero slot) and import, by logo alone', () => {
    expect(html).toContain('href="/new?via=Home.Hero"');
    expect(html).toContain('Start a Knowledgebase');
    expect(html).toMatch(/role="group" aria-label="Import From"/);
    expect(html).toMatch(
      /<a [^>]*href="\/features\/import#from-notion"[^>]*aria-label="Notion"|<a [^>]*aria-label="Notion"[^>]*href="\/features\/import#from-notion"/,
    );
    expect(html).toMatch(
      /<a [^>]*href="\/features\/import#from-confluence"[^>]*aria-label="Confluence"|<a [^>]*aria-label="Confluence"[^>]*href="\/features\/import#from-confluence"/,
    );
  });

  it('fills the first screen as every product’s hero does (hero-tall.css), under its own cap', () => {
    expect(html).toMatch(/<section class="[^"]*\bhero-tall\b/);
    expect(html).toMatch(/class="[^"]*\bhero-tall-copy\b/);
    expect(html).toContain('[--hero-tall-cap:46rem]');
  });

  it('keeps every control a whole touch target: the button 48px, the logo links 44px', () => {
    const links = [...html.matchAll(/<a [^>]*class="([^"]*)"/g)].map((m) => m[1]!.split(' '));
    expect(links).toHaveLength(3);
    expect(links[0]).toContain('h-12');
    for (const classes of links.slice(1)) expect(classes).toContain('h-11');
  });

  it('is illustrated: the drawing is in the static HTML, once, with one label', () => {
    expect(html.match(/<svg[^>]*role="img"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-label="Five small cubes[^"]*knowledge[^"]*"/);
    // Its box holds its shape before paint and rests while off screen.
    expect(html).toMatch(/class="[^"]*aspect-\[6\/5\][^"]*\[content-visibility:auto\]/);
  });

  it('draws its backdrop for the eye alone, resting off screen', () => {
    const sides = html.match(
      /<div aria-hidden="true" class="pointer-events-none[^"]*\[content-visibility:auto\][^"]*"/g,
    );
    expect(sides).toHaveLength(2);
  });
});

describe('the hero illustration', () => {
  const svg = renderToStaticMarkup(<HeroIllustration />);

  it('draws the five other apps’ cubes and the knowledgebase’s lime cube', () => {
    for (const hue of ['sky', 'violet', 'amber', 'rose', 'emerald']) {
      expect(svg, hue).toContain(`fill-${hue}-500`);
    }
    expect(svg).toContain('fill-brand-300');
    // Five connectors, each with running dashes.
    expect(svg.match(/class="kh-flow /g)).toHaveLength(5);
  });

  it('puts words on its two cards: a question, and a cited, verified answer', () => {
    expect(svg).toContain('How do we roll back');
    expect(svg).toContain('[1]');
    expect(svg).toContain('Release Runbook');
    expect(svg).toContain('Verified by Priya');
  });

  it('hides its parts from assistive technology behind the one label', () => {
    expect(svg).toMatch(/<svg[^>]*role="img"[^>]*>\s*<g aria-hidden="true"/);
  });
});
