import { describe, expect, it } from 'vitest';
import { articleJsonLd, collectionJsonLd, helpUrl, webSiteJsonLd } from './structured-data';

const PUBLISHER = { '@type': 'Organization', name: 'liveplanner', url: 'https://liveplanner.app' };

describe('helpUrl', () => {
  it('prefixes app-relative hrefs with the /help base', () => {
    expect(helpUrl('/user-interface/themes/')).toBe(
      'https://liveplanner.app/help/user-interface/themes/',
    );
    expect(helpUrl('/')).toBe('https://liveplanner.app/help/');
  });
});

describe('articleJsonLd', () => {
  const node = articleJsonLd({
    title: 'Themes',
    description: 'How themes work.',
    appPath: '/user-interface/themes/',
  });

  it('builds a TechArticle node with the resolved absolute URL', () => {
    const url = 'https://liveplanner.app/help/user-interface/themes/';
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
      name: 'liveplanner Help',
      url: 'https://liveplanner.app/help/',
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
        description: 'All about the editor.',
        appPath: '/user-interface/',
        items: [
          { name: 'Themes', appPath: '/user-interface/themes/' },
          { name: 'Undo', appPath: '/user-interface/undo/' },
        ],
      }),
    ).toMatchObject({
      '@type': 'CollectionPage',
      name: 'Canvas',
      url: 'https://liveplanner.app/help/user-interface/',
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: [
          {
            position: 1,
            name: 'Themes',
            url: 'https://liveplanner.app/help/user-interface/themes/',
          },
          { position: 2, name: 'Undo', url: 'https://liveplanner.app/help/user-interface/undo/' },
        ],
      },
    });
  });
});
