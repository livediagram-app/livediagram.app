// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageNotFound } from './PageNotFound';

// docs/specs/016-platform/router-app.md "Not found": a branded card with a way back, never a bare 404.
describe('PageNotFound', () => {
  it('says the page is not there and links home and to the help centre', () => {
    render(<PageNotFound />);
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeTruthy();
    expect(document.querySelectorAll('main')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Go to the Home Page' }).getAttribute('href')).toBe(
      '/',
    );
    expect(screen.getByRole('link', { name: 'Help Centre' }).getAttribute('href')).toBe('/help/');
  });

  it('takes a site its own way home', () => {
    render(<PageNotFound homeHref="/community/" homeLabel="Back to Community" />);
    expect(screen.getByRole('link', { name: 'Back to Community' }).getAttribute('href')).toBe(
      '/community/',
    );
  });

  it("sits inside a site's own main landmark without adding a second", () => {
    render(
      <main>
        <PageNotFound inMain homeHref="/help/" homeLabel="Browse Help Centre" />
      </main>,
    );
    expect(document.querySelectorAll('main')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeTruthy();
  });
});
