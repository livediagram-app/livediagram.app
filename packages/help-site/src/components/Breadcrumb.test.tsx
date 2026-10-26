import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Breadcrumb } from './Breadcrumb';

// The breadcrumb's BreadcrumbList structured data: rooted at the help home, and only where there is a trail. A
// list of the home alone is a one-item BreadcrumbList, which search engines reject (they want two or more).
const jsonLd = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/g)].map(
    (m) => JSON.parse(m[1]!) as { '@type': string; itemListElement: { name: string }[] },
  );

describe('Breadcrumb', () => {
  it('emits no BreadcrumbList on the help home', () => {
    const html = renderToStaticMarkup(<Breadcrumb items={[]} helpUrl="https://help.example" />);
    expect(jsonLd(html).filter((d) => d['@type'] === 'BreadcrumbList')).toEqual([]);
  });

  it('roots the list at the help home under it', () => {
    const html = renderToStaticMarkup(
      <Breadcrumb items={[{ label: 'Contact' }]} helpUrl="https://help.example" />,
    );
    const [list] = jsonLd(html);
    expect(list?.itemListElement.map((i) => i.name)).toEqual(['Help', 'Contact']);
  });
});
