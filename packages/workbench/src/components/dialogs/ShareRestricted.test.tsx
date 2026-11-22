// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { shareGateOf, shareRestrictionOf } from '../../lib/share-restriction';
import { accountsSignInUrl } from '../chrome/auth-routes';
import { SharePasswordGate } from './SharePasswordGate';
import { domainsInWords, ShareRestricted } from './ShareRestricted';

afterEach(() => cleanup());
beforeEach(() => window.history.replaceState(null, '', '/project/p1?s=CODE#t=2'));

const HERE = '/project/p1?s=CODE#t=2';
const hrefOf = (name: string) => screen.getByRole('link', { name }).getAttribute('href');

// liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Sharing and access": a share's sign-in rule turned the
// visitor away. The page says who the item is for, and every way out comes back to this very address.
describe('ShareRestricted', () => {
  it('asks a guest to sign in or create an account, coming back here', () => {
    render(
      <ShareRestricted
        noun="plan"
        restriction={{ reason: 'sign_in', domains: [] }}
        ownerName="Ada"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Sign in to open this plan' })).toBeTruthy();
    expect(
      screen.getByText(
        'Ada asked everyone who opens this plan to sign in with a liveworkspace account first.',
      ),
    ).toBeTruthy();
    expect(hrefOf('Sign In')).toBe(accountsSignInUrl(HERE));
    expect(hrefOf('Create Account')).toBe(accountsSignInUrl(HERE, true));
    expect(screen.queryByRole('link', { name: 'Use Another Account' })).toBeNull();
  });

  it('names the one domain a guest needs an account at', () => {
    render(
      <ShareRestricted
        noun="canvas"
        restriction={{ reason: 'sign_in', domains: ['acme.com'] }}
        ownerName={null}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'This canvas is restricted to @acme.com' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'The owner shared it with people at @acme.com. Sign in with an account there to open it.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Email domains' })).toBeNull();
  });

  it('offers an account at another domain Use Another Account, listing several domains', () => {
    render(
      <ShareRestricted
        noun="design"
        restriction={{ reason: 'domain', domains: ['acme.com', 'b.org'] }}
        ownerName="Ada"
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'This design is restricted to 2 email domains' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'You’re signed in with an account at another domain. Sign in with your @acme.com or @b.org account to open it.',
      ),
    ).toBeTruthy();
    expect(hrefOf('Use Another Account')).toBe(accountsSignInUrl(HERE, 'switch'));
    expect(hrefOf('Use Another Account')).toContain('screen=switch');
    expect(screen.getByRole('list', { name: 'Email domains' }).textContent).toBe('@acme.com@b.org');
    expect(screen.queryByRole('link', { name: 'Sign In' })).toBeNull();
  });

  it('opens the accounts site in a new tab from inside an embed', () => {
    const top = Object.getOwnPropertyDescriptor(window, 'top');
    Object.defineProperty(window, 'top', { value: {}, configurable: true });
    try {
      render(
        <ShareRestricted
          noun="plan"
          restriction={{ reason: 'sign_in', domains: [] }}
          ownerName={null}
        />,
      );
      expect(screen.getByRole('link', { name: 'Sign In' }).getAttribute('target')).toBe('_blank');
      expect(
        screen.getByText('It opens in a new tab. Once you’re signed in, reload this page.'),
      ).toBeTruthy();
    } finally {
      if (top) Object.defineProperty(window, 'top', top);
    }
  });

  it('counts a parent it may not read as a frame', () => {
    const top = Object.getOwnPropertyDescriptor(window, 'top');
    Object.defineProperty(window, 'top', {
      get: () => {
        throw new Error('cross-origin');
      },
      configurable: true,
    });
    try {
      render(
        <ShareRestricted
          noun="plan"
          restriction={{ reason: 'domain', domains: ['a.com'] }}
          ownerName={null}
        />,
      );
      expect(screen.getByRole('link', { name: 'Use Another Account' }).getAttribute('target')).toBe(
        '_blank',
      );
    } finally {
      if (top) Object.defineProperty(window, 'top', top);
    }
  });

  it('shows in the password gate’s place when the gate says restricted', () => {
    render(
      <SharePasswordGate
        noun="plan"
        invalid={false}
        ownerName={null}
        onSubmit={() => {}}
        restricted={{ reason: 'sign_in', domains: [] }}
      />,
    );
    expect(screen.queryByLabelText('Plan password')).toBeNull();
    expect(screen.getByRole('link', { name: 'Sign In' })).toBeTruthy();
  });
});

describe('share restriction helpers', () => {
  it('words the domains', () => {
    expect(domainsInWords([])).toBe('');
    expect(domainsInWords(['a.com'])).toBe('@a.com');
    expect(domainsInWords(['a.com', 'b.org', 'c.net'])).toBe('@a.com, @b.org or @c.net');
  });

  it('reads a refusal as the restricted page, keeping only real domain names', () => {
    expect(shareRestrictionOf('sign_in_required', null)).toEqual({
      reason: 'sign_in',
      domains: [],
    });
    expect(shareRestrictionOf('domain_not_allowed', ['acme.com', 3, ''])).toEqual({
      reason: 'domain',
      domains: ['acme.com'],
    });
    expect(shareRestrictionOf('not_found', ['acme.com'])).toBeNull();
    expect(shareRestrictionOf(undefined, null)).toBeNull();
  });

  it('opens the gate each refusal asks for, or none', () => {
    expect(shareGateOf('password_required')).toEqual({ passwordRequired: true, invalid: false });
    expect(shareGateOf('password_invalid')).toEqual({ passwordRequired: true, invalid: true });
    expect(shareGateOf('sign_in_required', ['acme.com'])).toEqual({
      passwordRequired: true,
      invalid: false,
      restricted: { reason: 'sign_in', domains: ['acme.com'] },
    });
    expect(shareGateOf('not_found')).toBeNull();
    expect(shareGateOf(null)).toBeNull();
  });
});
