import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { cardSubtitle, CARD_SUBTITLE_MAX, createSocialCard } from './social-card';

describe('createSocialCard', () => {
  const renderCard = createSocialCard({
    markSvg: '<svg/>',
    wordmark: 'thing',
    domain: 'example.test',
    headline: 'Make things together,',
    pitch: () => 'A pitch.',
    footer: 'Open the link.',
    colours: { ground: ['#000001', '#000002'], ink: '#000003', accent: '#000004' },
  });

  it("draws the product's mark, wordmark, headline, pitch and footer on its ground", () => {
    const html = renderToStaticMarkup(renderCard());
    expect(html).toContain('linear-gradient(135deg, #000001 0%, #ffffff 60%, #000002 100%)');
    expect(html).toContain(`src="data:image/svg+xml,${encodeURIComponent('<svg/>')}"`);
    expect(html).toContain('<span style="color:#000004">live</span><span>thing</span>');
    expect(html).toContain('<span>Make things together, </span>');
    expect(html).toContain('A pitch.');
    expect(html).toContain('example.test');
    expect(html).toContain('Open the link.');
  });

  it("shows a page's own kicker, title, subtitle and footer in place of the defaults", () => {
    const html = renderToStaticMarkup(
      renderCard({ kicker: 'Kick', title: 'Own title', subtitle: 'Own sub', footer: 'Own foot' }),
    );
    expect(html).toContain('Kick');
    expect(html).toContain('<span>Own title</span>');
    expect(html).not.toContain('Make things together');
    expect(html).toContain('Own sub');
    expect(html).toContain('Own foot');
    expect(html).not.toContain('A pitch.');
  });
});

describe('cardSubtitle', () => {
  it('keeps text that already fits', () => {
    expect(cardSubtitle('Short and sweet.')).toBe('Short and sweet.');
  });

  it('uses the first sentence when the whole text is too long', () => {
    const text = `First sentence fits. ${'Then a great deal more '.repeat(10)}`;
    expect(cardSubtitle(text)).toBe('First sentence fits.');
  });

  it('cuts at a whole word, never mid-word, and drops trailing punctuation', () => {
    const text = `Switch a tab to Plan and the work moves onto boards of cards: columns with WIP limits, swimlanes, card types with fields and more`;
    const out = cardSubtitle(text);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(CARD_SUBTITLE_MAX);
    expect(text.startsWith(out.slice(0, -1))).toBe(true);
    expect(text[out.length - 1]).toMatch(/[\s,]/);
  });

  it('cuts a single unbroken word at the limit', () => {
    expect(cardSubtitle('x'.repeat(200), 10)).toBe(`${'x'.repeat(9)}…`);
  });
});
