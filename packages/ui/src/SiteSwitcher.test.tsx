import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { explorerSwitchHref, SITES } from '@liveworkspace/sites';
import { SiteSwitcher } from './SiteSwitcher';

describe('SiteSwitcher', () => {
  const html = renderToStaticMarkup(
    <SiteSwitcher app="livediagram" current="livediagram.app">
      <a href="/">logo</a>
    </SiteSwitcher>,
  );

  it('keeps the logo, and adds a menu button for the sites', () => {
    expect(html).toContain('<a href="/">logo</a>');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-label="Switch site"');
  });

  it('lists liveworkspace.app first, then each app, marking this one', () => {
    const hrefs = [...html.matchAll(/role="menuitem"[^>]*|href="(https:[^"]+)"/g)]
      .map((m) => m[1])
      .filter(Boolean);
    expect(hrefs).toEqual(SITES.map((site) => site.url));
    expect(hrefs[0]).toBe('https://liveworkspace.app');
    expect(html).toMatch(
      /href="https:\/\/livediagram-router\.liveworkspace-easing509\.workers\.dev"[^>]*aria-current="page"/,
    );
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it('names each site without ".app"', () => {
    // "live" in the site's colour, then the rest of its name.
    for (const site of SITES)
      expect(html).toContain(`>live</span>${site.name.replace(/^live/, '')}</span>`);
    expect(html).not.toMatch(/>[a-z]+\.app<\/span>/);
  });
});

describe('SiteSwitcher on an Explorer page', () => {
  const hrefs = (html: string) =>
    [...html.matchAll(/href="(https:[^"]+)"[^>]*role="menuitem"/g)].map((m) => m[1]);

  it('points each site at its own Explorer at the same view, query kept', () => {
    const html = renderToStaticMarkup(
      <SiteSwitcher
        app="liveplanner"
        current="liveplanner.app"
        hrefFor={explorerSwitchHref('/explorer/folder', '?id=f1&from=liveplanner')}
      >
        <a href="/">logo</a>
      </SiteSwitcher>,
    );
    expect(hrefs(html)).toEqual([
      'https://liveworkspace.app/explorer/folder?id=f1',
      'https://livediagram-router.liveworkspace-easing509.workers.dev/explorer/folder?id=f1',
      'https://www.liveplanner.app/explorer/folder?id=f1',
      'https://www.livedocuments.app/explorer/folder?id=f1',
      'https://www.livedesign.app/explorer/folder?id=f1',
    ]);
    expect(html).toMatch(
      /href="https:\/\/www\.liveplanner\.app\/explorer[^"]*"[^>]*aria-current="page"/,
    );
  });

  it('links each site home off the Explorer', () => {
    const html = renderToStaticMarkup(
      <SiteSwitcher
        app="livediagram"
        current="livediagram.app"
        hrefFor={explorerSwitchHref('/help')}
      >
        <a href="/">logo</a>
      </SiteSwitcher>,
    );
    expect(hrefs(html)).toEqual(SITES.map((site) => site.url));
  });
});
