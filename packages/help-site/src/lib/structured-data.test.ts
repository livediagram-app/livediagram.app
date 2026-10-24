import { describe, expect, it } from 'vitest';
import { SITE } from '../test/fixture';
import { articleJsonLd, collectionJsonLd, helpUrl, webSiteJsonLd } from './structured-data';

const facts = SITE.facts;
const PUBLISHER = { '@type': 'Organization', name: 'testapp', url: 'https://testapp.example' };

describe('helpUrl', () => {
  it('prefixes app-relative hrefs with the /help base', () => {
    expect(helpUrl(facts, '/canvas/themes/')).toBe('https://testapp.example/help/canvas/themes/');
    expect(helpUrl(facts, '/')).toBe('https://testapp.example/help/');
  });
});

describe('articleJsonLd', () => {
  const node = articleJsonLd(facts, {
    title: 'Themes',
    description: 'How themes work.',
    appPath: '/canvas/themes/',
  });

  it('builds a TechArticle node with the resolved absolute URL', () => {
    const url = 'https://testapp.example/help/canvas/themes/';
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
    expect(webSiteJsonLd(facts)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'testapp Help',
      url: 'https://testapp.example/help/',
      publisher: PUBLISHER,
      inLanguage: 'en-GB',
    });
  });
});

describe('collectionJsonLd', () => {
  it("lists a landing page's articles in order, at absolute URLs", () => {
    expect(
      collectionJsonLd(facts, {
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
      url: 'https://testapp.example/help/canvas/',
      isPartOf: { '@type': 'WebSite', name: 'testapp Help' },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: [
          { position: 1, name: 'Themes', url: 'https://testapp.example/help/canvas/themes/' },
          { position: 2, name: 'Layers', url: 'https://testapp.example/help/canvas/layers/' },
        ],
      },
    });
  });
});
