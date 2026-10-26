// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { explorerSwitchHref } from '@liveworkspace/sites';
import { SiteSwitcher } from './SiteSwitcher';

// The switcher's links follow the page's environment (liveworkspace/docs/specs/010-site/site-switcher.md): a staging page links each
// site's staging origin, any other page each site's live one. The host is read in the browser, so this renders in
// jsdom at the page's address rather than to static markup.
const dom = (globalThis as unknown as { jsdom: { reconfigure(settings: { url: string }): void } })
  .jsdom;

function linksOn(pageUrl: string, hrefFor?: Parameters<typeof SiteSwitcher>[0]['hrefFor']) {
  dom.reconfigure({ url: pageUrl });
  render(
    <SiteSwitcher app="liveplanner" current="liveplanner.app" hrefFor={hrefFor}>
      <a href="/">logo</a>
    </SiteSwitcher>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Switch site' }));
  return screen.getAllByRole('menuitem').map((item) => item.getAttribute('href'));
}

const PRODUCTION = [
  'https://liveworkspace.app',
  'https://livediagram-router.liveworkspace-easing509.workers.dev',
  'https://www.liveplanner.app',
  'https://www.livedocuments.app',
  'https://www.livedesign.app',
];
const STAGING = [
  'https://staging.liveworkspace.app',
  'https://livediagram-router-staging.liveworkspace-easing509.workers.dev',
  'https://staging.liveplanner.app',
  'https://staging.livedocuments.app',
  'https://staging.livedesign.app',
];

describe("the site switcher's links in each environment", () => {
  afterEach(() => dom.reconfigure({ url: 'http://localhost:3000/' }));

  it.each([
    'https://www.liveplanner.app/new',
    'https://liveplanner.app/',
    'https://liveworkspace.app/dashboard',
    'https://livediagram-router.liveworkspace-easing509.workers.dev/',
  ])('links every live site from a production page (%s)', (page) => {
    expect(linksOn(page)).toEqual(PRODUCTION);
  });

  it.each([
    'https://staging.liveplanner.app/new',
    'https://staging.liveworkspace.app/dashboard',
    'https://livediagram-router-staging.liveworkspace-easing509.workers.dev/',
  ])('links every staging site from a staging page (%s), never production', (page) => {
    const links = linksOn(page);
    expect(links).toEqual(STAGING);
    for (const live of PRODUCTION) expect(links).not.toContain(live);
  });

  it("keeps an Explorer link's view and query on staging", () => {
    expect(
      linksOn(
        'https://staging.liveplanner.app/explorer/timeline',
        explorerSwitchHref('/explorer/timeline', '?id=t1'),
      ),
    ).toEqual(STAGING.map((origin) => `${origin}/explorer/timeline?id=t1`));
  });
});
