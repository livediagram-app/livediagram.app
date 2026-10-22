import { describe, expect, it } from 'vitest';
import { articleJsonLd, collectionJsonLd, helpUrl, webSiteJsonLd } from './structured-data';

const PUBLISHER = { '@type': 'Organization', name: 'livedocuments', url: 'https://livedocuments.app' };

describe('helpUrl', () => {
  it('prefixes app-relative hrefs with the /help base', () => {
    expect(helpUrl('/canvas/themes/')).toBe('https://livedocuments.app/help/canvas/themes/');
    expect(helpUrl('/')).toBe('https://livedocuments.app/help/');
  });
});

describe('articleJsonLd', () => {
  const node = articleJsonLd({
    title: 'Themes',
    description: 'How themes work.',
    appPath: '/canvas/themes/',
  });

  it('builds a TechArticle node with the resolved absolute URL', () => {
    const url = 'https://livedocuments.app/help/canvas/themes/';
    expect(node).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: 'Themes',
      description: 'How themes work.',
      url,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      inLanguage: 'en-GB',
      author: PUBLISHER,
      publisher: PUBLISHER,
    });
  });

  it('keeps mainEntityOfPage @id in sync with the article url', () => {
    expect(node.mainEntityOfPage['@id']).toBe(node.url);
  });
});

describe('webSiteJsonLd', () => {
  it('names the help centre WebSite node', () => {
    expect(webSiteJsonLd()).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'livedocuments Help',
      url: 'https://livedocuments.app/help/',
      publisher: PUBLISHER,
      inLanguage: 'en-GB',
    });
  });
});

describe('collectionJsonLd', () => {
  it("lists a landing page's articles in order, at absolute URLs", () => {
    expect(
      collectionJsonLd({
        title: 'Canvas',
        description: 'All about the canvas.',
        appPath: '/canvas/',
        items: [
          { name: 'Themes', appPath: '/canvas/themes/' },
          { name: 'Layers', appPath: '/canvas/layers/' },
        ],
      }),
    ).toMatchObject({
      '@type': 'CollectionPage',
      name: 'Canvas',
      url: 'https://livedocuments.app/help/canvas/',
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: [
          { position: 1, name: 'Themes', url: 'https://livedocuments.app/help/canvas/themes/' },
          { position: 2, name: 'Layers', url: 'https://livedocuments.app/help/canvas/layers/' },
        ],
      },
    });
  });
});
