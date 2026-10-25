// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HeaderPrimaryCta } from './HeaderPrimaryCta';
import { createSignedInHint } from './signed-in-hint';

// docs/specs/019-marketing/marketing-site.md "Header": Choose Template for a visitor, Open Explorer for
// someone signed in, as the product's readable hint cookie says.
const useSignedInHint = createSignedInHint((cookie) =>
  /(?:^|; )x_signed_in=1/.test(cookie) ? true : /(?:^|; )x_signed_in=0/.test(cookie) ? false : null,
);

function Cta(props: { quiet?: boolean; explorerWhenSignedIn?: boolean }) {
  return (
    <HeaderPrimaryCta
      newHref="/new?via=Home.Header"
      explorerHref="/explorer/home"
      signedIn={useSignedInHint()}
      {...props}
    />
  );
}

afterEach(() => {
  document.cookie = 'x_signed_in=; max-age=0; path=/';
});

describe('the header primary', () => {
  it('is Choose Template, into the wizard, for a visitor', () => {
    const a = render(<Cta />).container.querySelector('a')!;
    expect(a.getAttribute('aria-label')).toBe('Choose Template');
    expect(a.getAttribute('href')).toBe('/new?via=Home.Header');
  });

  it('is Open Explorer for someone signed in, and Choose Template again once signed out', () => {
    document.cookie = 'x_signed_in=1; path=/';
    const signedIn = render(<Cta />).container.querySelector('a')!;
    expect(signedIn.getAttribute('aria-label')).toBe('Open Explorer');
    expect(signedIn.getAttribute('href')).toBe('/explorer/home');
    document.cookie = 'x_signed_in=0; path=/';
    expect(
      render(<Cta />)
        .container.querySelector('a')!
        .getAttribute('href'),
    ).toBe('/new?via=Home.Header');
  });

  it('stays Choose Template on a marketing bar, signed in or not', () => {
    document.cookie = 'x_signed_in=1; path=/';
    for (const props of [{ explorerWhenSignedIn: false }, { quiet: true }]) {
      const a = render(<Cta {...props} />).container.querySelector('a')!;
      expect(a.getAttribute('aria-label')).toBe('Choose Template');
      expect(a.getAttribute('href')).toBe('/new?via=Home.Header');
    }
  });
});
