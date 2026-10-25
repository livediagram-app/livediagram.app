import { describe, expect, it } from 'vitest';
import { breadcrumbJsonLd } from './breadcrumb-json-ld';

describe('breadcrumbJsonLd', () => {
  it('numbers the crumbs from 1 and omits `item` for an unlinked crumb', () => {
    expect(
      breadcrumbJsonLd([
        {
          name: 'Help',
          url: 'https://livediagram-router.liveworkspace-easing509.workers.dev/help/',
        },
        {
          name: 'Canvas',
          url: 'https://livediagram-router.liveworkspace-easing509.workers.dev/help/canvas/',
        },
        { name: 'Themes' },
      ]),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Help',
          item: 'https://livediagram-router.liveworkspace-easing509.workers.dev/help/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Canvas',
          item: 'https://livediagram-router.liveworkspace-easing509.workers.dev/help/canvas/',
        },
        { '@type': 'ListItem', position: 3, name: 'Themes' },
      ],
    });
  });
});
