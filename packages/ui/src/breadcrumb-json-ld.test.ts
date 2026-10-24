import { describe, expect, it } from 'vitest';
import { breadcrumbJsonLd } from './breadcrumb-json-ld';

describe('breadcrumbJsonLd', () => {
  it('numbers the crumbs from 1 and omits `item` for an unlinked crumb', () => {
    expect(
      breadcrumbJsonLd([
        { name: 'Help', url: 'https://livediagram.app/help/' },
        { name: 'Canvas', url: 'https://livediagram.app/help/canvas/' },
        { name: 'Themes' },
      ]),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Help', item: 'https://livediagram.app/help/' },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Canvas',
          item: 'https://livediagram.app/help/canvas/',
        },
        { '@type': 'ListItem', position: 3, name: 'Themes' },
      ],
    });
  });
});
