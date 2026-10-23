// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GUEST_TOKEN_STORAGE_KEY } from '@/lib/guest-token-key';
import { guestTokenFor } from '@/lib/testing/guest-token';
import GuestHandoffPage from './page';

// The page the accounts site's guest handoff comes back to (liveworkspace/docs/one-explorer-contracts.md "Guests"):
// it keeps the token for the state this tab sent and goes back where the handoff started, replacing itself.

const replace = vi.fn();

function arrive(hash: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, hash, replace },
  });
}

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  replace.mockReset();
});

describe('/auth/guest', () => {
  it('keeps the token and returns to where the handoff started', () => {
    sessionStorage.setItem(
      'livedesign:guest-handoff',
      JSON.stringify({ state: 'state1234', returnTo: '/design/p1?s=code' }),
    );
    const token = guestTokenFor('guest_page');
    arrive(`#guest_token=${token}&state=state1234`);
    render(<GuestHandoffPage />);
    expect(localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)).toBe(token);
    expect(replace).toHaveBeenCalledWith('/design/p1?s=code');
  });

  it('goes to the Explorer with nothing kept when the handoff failed', () => {
    arrive('#error=guest_not_configured&state=x');
    render(<GuestHandoffPage />);
    expect(localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)).toBeNull();
    expect(replace).toHaveBeenCalledWith('/explorer');
  });
});
