import { describe, expect, it } from 'vitest';
import {
  creditFor,
  galleryNameFor,
  licenceLabel,
  OpenverseSearchError,
  openverseSearchUrl,
  parseOpenverseSearch,
  tileLabelFor,
  type OpenverseImage,
} from './openverse';

// docs/specs/009-elements/image-search.md

const raw = {
  id: '1c5442f6',
  title: 'Cat Fish 2',
  url: 'https://live.staticflickr.com/3313/3481540500_b.jpg',
  thumbnail: 'https://api.openverse.org/v1/images/1c5442f6/thumb/',
  width: 716,
  height: 1024,
  creator: 'admiller',
  license: 'by',
  license_version: '2.0',
  license_url: 'https://creativecommons.org/licenses/by/2.0/',
  foreign_landing_url: 'https://www.flickr.com/photos/32426194@N00/3481540500',
};

const parsed = (over: Partial<OpenverseImage> = {}): OpenverseImage => ({
  ...parseOpenverseSearch({ results: [raw], page_count: 1 }, 1).results[0]!,
  ...over,
});

describe('openverseSearchUrl', () => {
  it('asks for 20 commercially reusable, modifiable, non-mature results', () => {
    const url = new URL(openverseSearchUrl('server rack', 3));
    expect(url.origin + url.pathname).toBe('https://api.openverse.org/v1/images/');
    expect(url.searchParams.get('q')).toBe('server rack');
    expect(url.searchParams.get('page')).toBe('3');
    expect(url.searchParams.get('page_size')).toBe('20');
    expect(url.searchParams.get('license_type')).toBe('commercial,modification');
    expect(url.searchParams.get('mature')).toBe('false');
  });
});

describe('parseOpenverseSearch', () => {
  it('keeps the fields it uses', () => {
    const page = parseOpenverseSearch({ results: [raw], page_count: 12 }, 2);
    expect(page).toEqual({
      page: 2,
      pageCount: 12,
      results: [
        {
          id: '1c5442f6',
          url: raw.url,
          thumbnail: raw.thumbnail,
          width: 716,
          height: 1024,
          title: 'Cat Fish 2',
          creator: 'admiller',
          license: 'by',
          licenseVersion: '2.0',
          licenseUrl: raw.license_url,
          landingUrl: raw.foreign_landing_url,
        },
      ],
    });
  });

  it('drops results missing an id, an https url or a thumbnail', () => {
    const page = parseOpenverseSearch(
      {
        page_count: 1,
        results: [
          raw,
          { ...raw, id: '' },
          { ...raw, url: 'http://insecure.example/x.jpg' },
          { ...raw, thumbnail: null },
          'junk',
        ],
      },
      1,
    );
    expect(page.results.map((r) => r.id)).toEqual(['1c5442f6']);
  });

  it('treats a bad size as unknown and a missing page count as 0', () => {
    const page = parseOpenverseSearch({ results: [{ ...raw, width: -1, height: 'x' }] }, 1);
    expect(page.results[0]).toMatchObject({ width: null, height: null });
    expect(page.pageCount).toBe(0);
  });

  it('throws failed for an answer that is not a results page', () => {
    expect(() => parseOpenverseSearch(null, 1)).toThrow(OpenverseSearchError);
    expect(() => parseOpenverseSearch({ results: 'nope' }, 1)).toThrow(OpenverseSearchError);
  });
});

describe('licenceLabel', () => {
  it('labels CC, CC0 and the Public Domain Mark', () => {
    expect(licenceLabel('by', '2.0')).toBe('CC BY 2.0');
    expect(licenceLabel('by-sa', '4.0')).toBe('CC BY-SA 4.0');
    expect(licenceLabel('cc0', '1.0')).toBe('CC0 1.0');
    expect(licenceLabel('pdm')).toBe('Public Domain Mark 1.0');
    expect(licenceLabel(undefined)).toBeUndefined();
  });
});

describe('creditFor', () => {
  it('credits title, creator and licence, linking source and licence', () => {
    expect(creditFor(parsed())).toEqual({
      text: '"Cat Fish 2" by admiller, CC BY 2.0',
      sourceUrl: raw.foreign_landing_url,
      licenseUrl: raw.license_url,
    });
  });

  it('leaves out the parts Openverse does not know', () => {
    expect(creditFor(parsed({ title: undefined }))?.text).toBe('By admiller, CC BY 2.0');
    expect(creditFor(parsed({ creator: undefined }))?.text).toBe('"Cat Fish 2", CC BY 2.0');
    expect(creditFor(parsed({ licenseUrl: 'javascript:x' }))?.licenseUrl).toBeUndefined();
  });

  it('gives no credit without a source page to link to', () => {
    expect(creditFor(parsed({ landingUrl: undefined }))).toBeUndefined();
    expect(creditFor(parsed({ landingUrl: 'javascript:alert(1)' }))).toBeUndefined();
  });

  it('caps the text at 300 characters', () => {
    expect(creditFor(parsed({ title: 'x'.repeat(400) }))!.text).toHaveLength(300);
  });
});

describe('names', () => {
  it('names the gallery row and the tile', () => {
    expect(galleryNameFor(parsed())).toBe('Cat Fish 2');
    expect(galleryNameFor(parsed({ title: undefined }))).toBe('openverse-1c5442f6');
    expect(tileLabelFor(parsed())).toBe('Use Cat Fish 2 by admiller');
    expect(tileLabelFor(parsed({ title: undefined, creator: undefined }))).toBe('Use image');
  });
});
