import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { comparisons } from '../test/fixture';
import { ComparisonArticle } from './ComparisonArticle';
import { ComparisonHub } from './ComparisonHub';
import { ComparisonTable } from './ComparisonTable';
import { VsBadge } from './VsBadge';

const c = comparisons();
const mark = (className: string) => <i data-mark={className} />;
const html = (node: React.ReactElement) => {
  const div = document.createElement('div');
  div.innerHTML = renderToStaticMarkup(node);
  return div;
};

describe('the hub', () => {
  it('links every comparison once, then the app’s own call to action', () => {
    const root = html(<ComparisonHub comparisons={c} mark={mark} tryIt={<a href="/new">Try</a>} />);
    expect([...root.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      '/alternatives/miro',
      '/alternatives/trello',
      '/alternatives/figma',
      '/alternatives/jira',
      '/new',
    ]);
  });

  it('puts each comparison’s three chips on its card', () => {
    const root = html(<ComparisonHub comparisons={c} mark={mark} tryIt={null} />);
    expect(root.querySelector('a')!.textContent).toContain('Free, no tiersNo sign-upOpen source');
  });
});

describe('a comparison', () => {
  const alt = c.alternatives[1]!;
  const root = html(
    <ComparisonArticle comparisons={c} alt={alt} mark={mark} tryIt={<p id="try" />} />,
  );

  it('indexes every section it shows', () => {
    const toc = [...root.querySelectorAll('nav a')].map((a) => a.getAttribute('href'));
    expect(toc).toEqual(['#at-a-glance', '#which-to-pick', '#section-1', '#faq']);
    for (const id of toc) expect(root.querySelector(id!)).not.toBeNull();
  });

  it('weighs both sides of the choice', () => {
    const picks = root.querySelectorAll('#which-to-pick h3');
    expect([...picks].map((h) => h.textContent)).toEqual([
      'Why pick testapp',
      'Where Trello is the better pick',
    ]);
  });

  it('answers every FAQ in the static HTML, with no script', () => {
    const answers = root.querySelectorAll('#faq details');
    expect(answers).toHaveLength(alt.faqs.length);
    expect(answers[0]!.textContent).toContain(alt.faqs[0]!.a);
  });

  it('dates its review and links three others, not itself', () => {
    expect(root.querySelector('time')!.getAttribute('dateTime')).toBe('2026-10-23');
    expect(root.textContent).toContain('Last reviewed 23 October 2026.');
    const others = [...root.querySelectorAll('section[aria-labelledby="others-title"] > div > a')];
    expect(others.map((a) => a.getAttribute('href'))).toEqual([
      '/alternatives/figma',
      '/alternatives/jira',
      '/alternatives/miro',
    ]);
    expect(root.querySelector('#try')).not.toBeNull();
  });
});

describe('the table', () => {
  it('describes itself and scopes its headers', () => {
    const root = html(<ComparisonTable app="testapp" alt={c.alternatives[0]!} />);
    expect(root.querySelector('caption')!.textContent).toBe(
      'testapp vs Miro: feature-by-feature comparison',
    );
    expect(root.querySelectorAll('th[scope="col"]')).toHaveLength(3);
    expect(root.querySelector('th[scope="row"]')!.textContent).toBe('Price');
  });
});

describe('the vs tiles', () => {
  it('draw the app’s mark and the competitor’s glyph, hidden from screen readers', () => {
    const root = html(<VsBadge slug="miro" mark={mark} />);
    const badge = root.firstElementChild!;
    expect(badge.getAttribute('aria-hidden')).toBe('true');
    expect(badge.querySelector('[data-mark="size-9"]')).not.toBeNull();
    expect(badge.querySelector('svg')).not.toBeNull();
  });
});
