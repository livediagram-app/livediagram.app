// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/clerk-config', () => ({ clerkEnabled: false, sessionsEnabled: false }));
vi.mock('@/components/providers/deferred-auth', () => ({ useDeferredAuth: () => ({}) }));
vi.mock('@/components/chrome/auth-shared', () => ({ useAuthHrefs: () => ({}) }));

const { SignInPrompt } = await import('./SignInPrompt');

const KEY = 'livedesign:v2:signin-prompt-dismissed';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('SignInPrompt', () => {
  // The designs are saved on the server; only the guest id lives in the browser, so the bar never says
  // "Browser only" beside a card that reads Private.
  it('says the bar form is about who can open the designs, never Browser only', () => {
    render(<SignInPrompt bar />);
    expect(screen.getByText(/^No sign-in here\.$/)).toBeTruthy();
    expect(screen.getByText('Only this browser can open your designs.')).toBeTruthy();
    expect(screen.queryByText(/Browser only/)).toBeNull();
  });

  it('shows the prompt until dismissed, then the fallback, and remembers it', () => {
    render(<SignInPrompt fallback={<span>fallback</span>} />);
    expect(screen.getByText('No sign-in on this deployment')).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(screen.getByText('fallback')).toBeTruthy();
    expect(window.localStorage.getItem(KEY)).toBe('true');
  });

  it('shows the fallback straight away for a dismissal made earlier', () => {
    window.localStorage.setItem(KEY, 'true');
    render(<SignInPrompt fallback={<span>fallback</span>} />);
    expect(screen.queryByText('No sign-in on this deployment')).toBeNull();
    expect(screen.getByText('fallback')).toBeTruthy();
  });
});
