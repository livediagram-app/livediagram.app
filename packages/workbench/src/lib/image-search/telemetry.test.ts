import { describe, expect, it } from 'vitest';
import {
  IMAGE_SEARCH_THUMBNAIL_FALLBACK,
  IMAGE_SEARCH_WARNINGS,
  pickWarningType,
  searchWarningType,
} from './telemetry';

// docs/specs/009-elements/image-search.md "Telemetry".

describe('image search warning tokens', () => {
  it('types search failures by kind', () => {
    expect(searchWarningType('rate-limited')).toBe('ImageSearch.RateLimited');
    expect(searchWarningType('failed')).toBe('ImageSearch.SearchFailed');
  });

  it('types pick failures in PascalCase under Pick', () => {
    expect(pickWarningType('download-failed')).toBe('ImageSearch.Pick.DownloadFailed');
    expect(pickWarningType('gallery-full')).toBe('ImageSearch.Pick.GalleryFull');
    expect(pickWarningType('offline-budget')).toBe('ImageSearch.Pick.OfflineBudget');
  });

  it('lists every token once, each a fixed dotted PascalCase word', () => {
    expect(IMAGE_SEARCH_WARNINGS).toContain(IMAGE_SEARCH_THUMBNAIL_FALLBACK);
    expect(new Set(IMAGE_SEARCH_WARNINGS).size).toBe(IMAGE_SEARCH_WARNINGS.length);
    expect(IMAGE_SEARCH_WARNINGS).toHaveLength(11);
    for (const t of IMAGE_SEARCH_WARNINGS) expect(t).toMatch(/^ImageSearch(\.[A-Z][A-Za-z]+)+$/);
  });
});
