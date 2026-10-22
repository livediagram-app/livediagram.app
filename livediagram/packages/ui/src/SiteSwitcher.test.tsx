import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SiteSwitcher } from './SiteSwitcher';

describe('SiteSwitcher', () => {
  const html = renderToStaticMarkup(
    <SiteSwitcher current="livediagram.app">
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
    expect(hrefs).toEqual([
      'https://liveworkspace.app',
      'https://livediagram.app',
      'https://liveplanner.app',
    ]);
    expect(html).toMatch(/href="https:\/\/livediagram\.app"[^>]*aria-current="page"/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });
});
