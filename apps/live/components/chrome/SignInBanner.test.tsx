// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/chrome/auth-shared', () => ({
  useAuthHrefs: () => ({ signInHref: '/sign-in/' }),
}));
vi.mock('@/components/chrome/AuthControls', () => ({ SignInIcon: () => null }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const { SignInBanner, SIGNIN_BANNER_VAR } = await import('./SignInBanner');

afterEach(cleanup);

// docs/specs/014-identity/sign-in-encouragement.md: the toasts stand on the banner while it shows, rather than
// landing on its words ("Document deleted · Undo" did). It says how far up its top sits, and stops saying so when it goes.
describe('SignInBanner', () => {
  it('publishes how far its top sits above the bottom of the screen, and clears it on leaving', () => {
    const root = document.documentElement;
    const top = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ top: window.innerHeight - 180 } as DOMRect);
    const view = render(<SignInBanner surface="Explorer" onDismiss={() => {}} />);
    expect(root.style.getPropertyValue(SIGNIN_BANNER_VAR)).toBe('180px');
    view.unmount();
    expect(root.style.getPropertyValue(SIGNIN_BANNER_VAR)).toBe('');
    top.mockRestore();
  });
});
