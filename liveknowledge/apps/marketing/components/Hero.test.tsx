import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { HERO_HEADLINE, PITCH_LINE } from '@/lib/site-words';
import { Hero } from './Hero';
import { HeroIllustration } from './HeroIllustration';

// docs/specs/019-marketing/marketing-site.md "Hero".
describe('the hero', () => {
  const html = renderToStaticMarkup(<Hero />);

  it('says what liveknowledge is, in one h1 and the pitch line', () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain(HERO_HEADLINE);
    expect(html).toContain(PITCH_LINE);
  });

  it('offers the two ways in: start (the funnel’s Home.Hero slot) and import', () => {
    expect(html).toContain('href="/new?via=Home.Hero"');
    expect(html).toContain('Start a Knowledgebase');
    expect(html).toMatch(/href="#import"[^>]*>.*Import From Notion or Confluence/s);
  });

  it('fills the first screen as every product’s hero does (hero-tall.css)', () => {
    expect(html).toMatch(/<section class="[^"]*\bhero-tall\b/);
    expect(html).toMatch(/class="[^"]*\bhero-tall-copy\b/);
  });

  it('keeps both buttons 48px tall, a whole touch target on a phone', () => {
    const buttons = [...html.matchAll(/<a [^>]*class="([^"]*)"/g)].map((m) => m[1]!.split(' '));
    expect(buttons).toHaveLength(2);
    for (const classes of buttons) expect(classes).toContain('h-12');
  });

  it('is illustrated: the drawing is in the static HTML, once, with one label', () => {
    expect(html.match(/<svg[^>]*role="img"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-label="Five small cubes[^"]*knowledge[^"]*"/);
    // Its box holds its shape before paint and rests while off screen.
    expect(html).toMatch(/class="[^"]*aspect-\[6\/5\][^"]*\[content-visibility:auto\]/);
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
