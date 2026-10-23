import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SITES } from '@liveworkspace/sites';
import { SiteSwitcher } from './SiteSwitcher';

describe('SiteSwitcher', () => {
  const html = renderToStaticMarkup(
    <SiteSwitcher current="livedocuments.app">
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
    expect(html).toMatch(/href="https:\/\/www\.livedocuments\.app"[^>]*aria-current="page"/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it('names each site without ".app"', () => {
    // "live" in the site's colour, then the rest of its name.
    for (const site of SITES)
      expect(html).toContain(`>live</span>${site.name.replace(/^live/, '')}</span>`);
    expect(html).not.toMatch(/>[a-z]+\.app<\/span>/);
  });
});
