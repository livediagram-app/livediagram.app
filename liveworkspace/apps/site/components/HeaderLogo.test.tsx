// @vitest-environment jsdom
import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// liveworkspace/docs/specs/010-site/site.md "The header": under an app's own address the sign-in pages wear that
// app's logo; elsewhere, and on the server's render, the header is liveworkspace's.
const here = vi.hoisted(() => ({ origin: 'http://localhost:3000' }));
vi.mock('@liveworkspace/sites', async (actual) => {
  const sites = await actual<typeof import('@liveworkspace/sites')>();
  return { ...sites, appOfAnyOrigin: () => sites.appOfAnyOrigin(here.origin) };
});

const { HeaderLogo } = await import('./HeaderLogo');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  here.origin = 'http://localhost:3000';
});

const workspace = (
  <a href="/" aria-label="liveworkspace home">
    liveworkspace
  </a>
);
const homeLink = () => host.querySelector('a[href="/"]');

describe('the header logo', () => {
  it("is liveworkspace's wordmark on liveworkspace.app", () => {
    act(() => root.render(<HeaderLogo appAware>{workspace}</HeaderLogo>));
    expect(homeLink()?.getAttribute('aria-label')).toBe('liveworkspace home');
  });

  it("wears the app's logo on an app's own address when asked to", async () => {
    here.origin = 'https://www.liveplanner.app';
    await act(async () => root.render(<HeaderLogo appAware>{workspace}</HeaderLogo>));
    // liveworkspace's logo until the app's arrives.
    await vi.waitFor(() =>
      expect(homeLink()?.getAttribute('aria-label')).not.toBe('liveworkspace home'),
    );
    expect(homeLink()?.textContent).toContain('planner');
    // "live" in liveplanner's deep violet, not the site's own brand-700.
    const slot = homeLink()!.closest<HTMLElement>('[style*="--color-brand-700"]');
    expect(slot?.style.getPropertyValue('--color-brand-700')).toBe('#6d28d9');
  });

  it("stays liveworkspace's on an app's address when not asked to", () => {
    here.origin = 'https://www.liveplanner.app';
    act(() => root.render(<HeaderLogo>{workspace}</HeaderLogo>));
    expect(homeLink()?.getAttribute('aria-label')).toBe('liveworkspace home');
  });

  it("renders liveworkspace's on the server, whatever the address", () => {
    here.origin = 'https://www.liveplanner.app';
    expect(renderToString(<HeaderLogo appAware>{workspace}</HeaderLogo>)).toContain(
      'liveworkspace home',
    );
  });
});
