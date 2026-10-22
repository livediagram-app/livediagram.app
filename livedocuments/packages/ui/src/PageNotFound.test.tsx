// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageNotFound } from './PageNotFound';

// docs/specs/016-platform/router-app.md "Not found": a branded card with a way back, never a bare 404.
describe('PageNotFound', () => {
  it('says the page is not there and links home and to the help centre', () => {
    render(<PageNotFound />);
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to the Home Page' }).getAttribute('href')).toBe(
      '/',
    );
    expect(screen.getByRole('link', { name: 'Help Centre' }).getAttribute('href')).toBe('/help/');
  });

  it('takes a site its own way home', () => {
    render(<PageNotFound homeHref="/help/" homeLabel="Back to Help" />);
    expect(screen.getByRole('link', { name: 'Back to Help' }).getAttribute('href')).toBe('/help/');
  });
});
