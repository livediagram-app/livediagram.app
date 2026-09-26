import { describe, expect, it } from 'vitest';
import {
  ALL_CTA_SOURCES,
  CTA_SOURCES,
  ctaHref,
  ctaSlotOf,
  ctaSourceFromSearch,
  ctaSurfaceOf,
  ctaSurfaceOfPath,
  isCtaSource,
} from './cta-sources';
import { TELEMETRY_TYPE_PATTERN, isValidTelemetryEvent } from './telemetry-schema';

describe('CTA_SOURCES', () => {
  // Pinned: renaming a source starts a fresh series on the public dashboard
  // and orphans every stored row, so it should be a deliberate edit here.
  it('is the table docs/specs/019-marketing/landing-funnel.md documents', () => {
    expect(ALL_CTA_SOURCES).toEqual([
      'Home.Header',
      'Home.HeaderDraw',
      'Home.Hero',
      'Home.HeroDraw',
      'Home.Gallery',
      'Home.GalleryDraw',
      'Home.Closing',
      'Feature.Header',
      'Feature.HeaderDraw',
      'Feature.Hero',
      'Feature.Closing',
      'Compare.Header',
      'Compare.HeaderDraw',
      'Compare.Card',
      'Faq.Header',
      'Faq.HeaderDraw',
      'Faq.Card',
      'Status.Header',
      'Status.HeaderDraw',
      'Dashboard.Header',
      'Dashboard.HeaderDraw',
      'Help.Header',
    ]);
  });

  it('only holds tokens the telemetry type pattern accepts', () => {
    for (const source of ALL_CTA_SOURCES) expect(source).toMatch(TELEMETRY_TYPE_PATTERN);
  });

  it('has no duplicate slot on a surface', () => {
    for (const slots of Object.values(CTA_SOURCES)) {
      expect(new Set(slots).size).toBe(slots.length);
    }
  });

  it('splits a source into its surface and slot', () => {
    expect(ctaSurfaceOf('Home.GalleryDraw')).toBe('Home');
    expect(ctaSlotOf('Home.GalleryDraw')).toBe('GalleryDraw');
  });
});

describe('isCtaSource', () => {
  it('accepts only sources in the table', () => {
    expect(isCtaSource('Home.Hero')).toBe(true);
    expect(isCtaSource('Help.HeaderDraw')).toBe(false);
    expect(isCtaSource('Home.hero')).toBe(false);
    expect(isCtaSource('Home')).toBe(false);
    expect(isCtaSource('')).toBe(false);
    expect(isCtaSource(null)).toBe(false);
    expect(isCtaSource(42)).toBe(false);
  });
});

describe('ctaHref', () => {
  it('adds the source as the only query', () => {
    expect(ctaHref('/new', 'Home.Hero')).toBe('/new?via=Home.Hero');
  });

  it('keeps an existing query', () => {
    expect(ctaHref('/new?blank=1', 'Home.HeroDraw')).toBe('/new?blank=1&via=Home.HeroDraw');
    expect(ctaHref('/new?template=kanban', 'Home.Gallery')).toBe(
      '/new?template=kanban&via=Home.Gallery',
    );
    expect(ctaHref('/new?', 'Faq.Card')).toBe('/new?via=Faq.Card');
  });

  it('keeps a hash after the query', () => {
    expect(ctaHref('/new#x', 'Faq.Card')).toBe('/new?via=Faq.Card#x');
  });

  it('round-trips through the reader for every source', () => {
    for (const source of ALL_CTA_SOURCES) {
      const href = ctaHref('/new?blank=1', source);
      expect(ctaSourceFromSearch(href.slice(href.indexOf('?')))).toBe(source);
    }
  });
});

describe('ctaSourceFromSearch', () => {
  it('reads a known source and ignores the rest of the query', () => {
    expect(ctaSourceFromSearch('?template=kanban&via=Home.Gallery&folder=f1')).toBe('Home.Gallery');
  });

  it('ignores an unknown or missing source', () => {
    expect(ctaSourceFromSearch('')).toBeNull();
    expect(ctaSourceFromSearch('?blank=1')).toBeNull();
    expect(ctaSourceFromSearch('?via=Home.Nope')).toBeNull();
    expect(ctaSourceFromSearch('?via=<script>')).toBeNull();
  });
});

describe('ctaSurfaceOfPath', () => {
  it('maps each public page onto its surface', () => {
    expect(ctaSurfaceOfPath('/')).toBe('Home');
    expect(ctaSurfaceOfPath('/features/present')).toBe('Feature');
    expect(ctaSurfaceOfPath('/alternatives')).toBe('Compare');
    expect(ctaSurfaceOfPath('/alternatives/miro')).toBe('Compare');
    expect(ctaSurfaceOfPath('/faq')).toBe('Faq');
    expect(ctaSurfaceOfPath('/status')).toBe('Status');
    expect(ctaSurfaceOfPath('/telemetry')).toBe('Dashboard');
    expect(ctaSurfaceOfPath('/help')).toBe('Help');
    expect(ctaSurfaceOfPath('/help/canvas/the-canvas')).toBe('Help');
  });

  it('leaves the editor and other pages out', () => {
    expect(ctaSurfaceOfPath('/new')).toBeNull();
    expect(ctaSurfaceOfPath('/diagram')).toBeNull();
    expect(ctaSurfaceOfPath('/explorer/recent')).toBeNull();
    expect(ctaSurfaceOfPath('/features')).toBeNull();
    expect(ctaSurfaceOfPath('/terms')).toBeNull();
  });
});

describe('Cta events at ingest', () => {
  it('accepts an arrival or a creation from a known source', () => {
    expect(isValidTelemetryEvent({ category: 'Cta', action: 'Opened', type: 'Home.Hero' })).toBe(
      true,
    );
    expect(
      isValidTelemetryEvent({ category: 'Cta', action: 'Created', type: 'Feature.Closing' }),
    ).toBe(true);
  });

  it('drops any other action, a missing type, or a source outside the table', () => {
    expect(isValidTelemetryEvent({ category: 'Cta', action: 'Selected', type: 'Home.Hero' })).toBe(
      false,
    );
    expect(isValidTelemetryEvent({ category: 'Cta', action: 'Opened' })).toBe(false);
    expect(isValidTelemetryEvent({ category: 'Cta', action: 'Opened', type: null })).toBe(false);
    expect(isValidTelemetryEvent({ category: 'Cta', action: 'Opened', type: 'Home.Nope' })).toBe(
      false,
    );
  });
});
