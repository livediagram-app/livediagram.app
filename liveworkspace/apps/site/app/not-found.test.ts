import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { metadata as root } from './layout';
import NotFound, { metadata } from './not-found';

// An unknown address must never pass itself off as the home page (liveworkspace/docs/specs/010-site/site.md).
describe('the not-found page', () => {
  it('has its own title and description, not the home page’s', () => {
    expect(metadata.title).toBe('Nothing here · liveworkspace');
    expect(metadata.title).not.toBe(root.title);
    expect(metadata.description).not.toBe(root.description);
  });

  it('claims no canonical or Open Graph address, and is not indexed', () => {
    expect(metadata.alternates?.canonical).toBeUndefined();
    expect(metadata.openGraph).toBeDefined();
    expect((metadata.openGraph as { url?: unknown }).url).toBeUndefined();
    expect(metadata.openGraph?.title).toBe(metadata.title);
    expect(metadata.robots).toMatchObject({ index: false });
  });
});

// Work Tracker 446: the site's error card, drawn on the server, with the way home and the status page.
describe('the not-found card', () => {
  const html = renderToStaticMarkup(NotFound());

  it('is the shared empty state in a main landmark, its heading the page’s one h1', () => {
    expect(html.startsWith('<main')).toBe(true);
    expect(html).toContain('data-empty-state="page"');
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Nothing here<\/h1>/);
  });

  it('leads home and to the status page', () => {
    expect(html).toMatch(/<a href="\/"[^>]*>(<span[^>]*>)*Go to the Home Page/);
    expect(html).toMatch(/<a href="\/status"[^>]*>Check the Status Page<\/a>/);
    expect(html).toContain('Followed a link that should work?');
  });
});
