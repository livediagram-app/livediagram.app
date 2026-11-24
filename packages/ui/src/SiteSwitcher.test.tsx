// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { APP_SITES, explorerSwitchHref, PLATFORM_SITE, SITES } from '@liveworkspace/sites';
import { SiteSwitcher } from './SiteSwitcher';

// The rows' order: the apps, then the account every app shares.
const ORDER = [...APP_SITES, PLATFORM_SITE];

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

  it('lists each app, then liveworkspace.app, marking this one', () => {
    const hrefs = [...html.matchAll(/href="(https:[^"]+)"[^>]*role="menuitem"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(ORDER.map((site) => site.url));
    expect(hrefs.at(-1)).toBe('https://www.liveworkspace.app');
    expect(html).toMatch(/href="https:\/\/www\.livediagram\.app"[^>]*aria-current="page"/);
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
      'https://www.livediagram.app/explorer/folder?id=f1',
      'https://www.liveplanner.app/explorer/folder?id=f1',
      'https://www.livedocuments.app/explorer/folder?id=f1',
      'https://www.livedesign.app/explorer/folder?id=f1',
      'https://www.livehuddle.app/explorer/folder?id=f1',
      'https://www.liveknowledge.app/explorer/folder?id=f1',
      'https://www.liveworkspace.app/explorer/folder?id=f1',
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
    expect(hrefs(html)).toEqual(ORDER.map((site) => site.url));
  });
});

describe('SiteSwitcher in the browser', () => {
  it('names its menu "liveworkspace sites", not after its trigger', () => {
    render(
      <SiteSwitcher app="livediagram" current="livediagram.app">
        <a href="/">logo</a>
      </SiteSwitcher>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Switch site' }));
    expect(screen.getByRole('menu').getAttribute('aria-label')).toBe('liveworkspace sites');
  });
});

describe('SiteSwitcher preview pane', () => {
  const renderOpen = () => {
    render(
      <SiteSwitcher app="livediagram" current="livediagram.app">
        <a href="/">logo</a>
      </SiteSwitcher>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Switch site' }));
    return () => document.querySelector<HTMLElement>('[data-site-preview]');
  };

  it('starts on the current site, out of the tab order and the accessibility tree', () => {
    const pane = renderOpen();
    expect(pane()?.dataset.sitePreview).toBe('livediagram.app');
    expect(pane()?.getAttribute('aria-hidden')).toBe('true');
    expect(pane()?.tabIndex).toBe(-1);
    expect(pane()?.getAttribute('role')).toBeNull();
    expect(pane()?.textContent).toContain('Diagram and draw together');
    expect(pane()?.textContent).toContain('You’re here');
  });

  it('shows the site pointed at or focused, links where its row does, and returns on leaving', () => {
    const pane = renderOpen();
    const planner = screen.getByRole('menuitem', { name: /liveplanner/ });
    fireEvent.pointerEnter(planner);
    expect(pane()?.dataset.sitePreview).toBe('liveplanner.app');
    expect(pane()?.getAttribute('href')).toBe(planner.getAttribute('href'));
    expect(pane()?.textContent).toContain('Open liveplanner');
    fireEvent.focus(screen.getByRole('menuitem', { name: /liveworkspace/ }));
    expect(pane()?.dataset.sitePreview).toBe('liveworkspace.app');
    fireEvent.pointerLeave(pane()!.parentElement!.parentElement!);
    expect(pane()?.dataset.sitePreview).toBe('livediagram.app');
  });

  it("gives every row its site's pitch for a screen reader", () => {
    renderOpen();
    for (const site of SITES)
      expect(screen.getByRole('menuitem', { name: new RegExp(site.pitch) })).toBeTruthy();
  });
});

describe('SiteSwitcher account strip', () => {
  it('names liveworkspace for a phone, hidden from assistive technology, marking it when current', () => {
    render(
      <SiteSwitcher app="livediagram" current="liveworkspace.app">
        <a href="/">logo</a>
      </SiteSwitcher>,
    );
    const strip = document.querySelector<HTMLElement>('[data-account-strip]');
    expect(strip?.getAttribute('href')).toBe('https://www.liveworkspace.app');
    expect(strip?.getAttribute('aria-hidden')).toBe('true');
    expect(strip?.tabIndex).toBe(-1);
    expect(strip?.textContent).toContain('One account across every app');
    expect(strip?.textContent).toContain('here');
  });
});
