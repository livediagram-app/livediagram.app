import { describe, expect, it } from 'vitest';
import { isValidPageViewPath, pageViewApp, pageViewPath } from './page-views';
import { isValidTelemetryEvent } from './telemetry-schema';

describe('pageViewPath', () => {
  it('keeps the page and drops the trailing slash', () => {
    expect(pageViewPath('/')).toBe('/');
    expect(pageViewPath('/help/canvas/the-canvas/')).toBe('/help/canvas/the-canvas');
    expect(pageViewPath('/explorer/recent')).toBe('/explorer/recent');
    expect(pageViewPath('/alternatives/miro')).toBe('/alternatives/miro');
  });

  it('lower-cases and strips .html / index.html', () => {
    expect(pageViewPath('/FAQ')).toBe('/faq');
    expect(pageViewPath('/privacy.html')).toBe('/privacy');
    expect(pageViewPath('/help/index.html')).toBe('/help');
    expect(pageViewPath('/index.html')).toBe('/');
  });

  it('collapses every diagram URL to one page, whatever follows', () => {
    expect(pageViewPath('/diagram/3f2b8c1e-9a4d-4e7b-8c21-0d5e6f7a8b9c')).toBe('/diagram/[id]');
    expect(pageViewPath('/diagram/offline-abc')).toBe('/diagram/[id]');
    expect(pageViewPath('/diagram/abc/extra/Weird Stuff!')).toBe('/diagram/[id]');
    expect(pageViewPath('/diagram')).toBe('/diagram');
  });

  it('collapses id-looking segments anywhere else', () => {
    expect(pageViewPath('/embed/3f2b8c1e-9a4d-4e7b-8c21-0d5e6f7a8b9c')).toBe('/embed/[id]');
    expect(pageViewPath('/x/a1b2c3d4e5f6g7h8')).toBe('/x/[id]');
    // Slugs are not ids, however long.
    expect(pageViewPath('/help/tips-and-tricks/keyboard-shortcuts')).toBe(
      '/help/tips-and-tricks/keyboard-shortcuts',
    );
  });

  it('drops a path it cannot express safely rather than sending it', () => {
    expect(pageViewPath('/help/some thing')).toBeNull();
    expect(pageViewPath('/a/b/c/d/e/f/g')).toBeNull();
    expect(pageViewPath('/%E0%A4%A')).toBeNull();
    expect(pageViewPath('/<script>')).toBeNull();
    expect(pageViewPath(`/${'a'.repeat(61)}`)).toBeNull();
  });

  it('only ever produces paths the ingest accepts', () => {
    for (const p of ['/', '/help/tabs', '/diagram/x', '/embed/0123456789abcdef', '/FAQ/']) {
      const out = pageViewPath(p);
      expect(out).not.toBeNull();
      expect(isValidPageViewPath(out!)).toBe(true);
    }
  });
});

describe('pageViewApp', () => {
  it('classifies a path by the app the router sends it to', () => {
    expect(pageViewApp('/')).toBe('Marketing');
    expect(pageViewApp('/alternatives/miro')).toBe('Marketing');
    expect(pageViewApp('/help')).toBe('Help');
    expect(pageViewApp('/help/canvas/the-canvas')).toBe('Help');
    expect(pageViewApp('/telemetry')).toBe('Dashboard');
    expect(pageViewApp('/explorer/recent')).toBe('Editor');
    expect(pageViewApp('/diagram/[id]')).toBe('Editor');
    expect(pageViewApp('/new')).toBe('Editor');
  });
});

describe('Page·View validation', () => {
  it('accepts a normalised path', () => {
    expect(isValidTelemetryEvent({ category: 'Page', action: 'View', type: '/' })).toBe(true);
    expect(isValidTelemetryEvent({ category: 'Page', action: 'View', type: '/diagram/[id]' })).toBe(
      true,
    );
  });

  it('rejects a raw or missing path, and any other Page action', () => {
    const bad = [
      { category: 'Page', action: 'View', type: null },
      { category: 'Page', action: 'View', type: '/join?token=abc' },
      { category: 'Page', action: 'View', type: '/Help' },
      { category: 'Page', action: 'View', type: 'help' },
      { category: 'Page', action: 'View', type: `/${'a'.repeat(200)}` },
      { category: 'Page', action: 'Opened', type: '/' },
    ];
    for (const e of bad) expect(isValidTelemetryEvent(e)).toBe(false);
  });

  it('keeps the token pattern for every other category', () => {
    expect(isValidTelemetryEvent({ category: 'Help', action: 'View', type: '/help/tabs' })).toBe(
      false,
    );
  });
});
