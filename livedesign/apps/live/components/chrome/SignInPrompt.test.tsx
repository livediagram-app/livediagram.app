// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ authLoaded: true, isSignedIn: false }));
vi.mock('@liveworkspace/workbench/components/providers/deferred-auth', () => ({ useDeferredAuth: () => auth }));
vi.mock('@/components/chrome/auth-shared', () => ({
  useAuthHrefs: () => ({ signInHref: '/live/sign-in/' }),
}));

const { SignInPrompt } = await import('./SignInPrompt');

const KEY = 'livedesign:v2:signin-prompt-dismissed';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  auth.authLoaded = true;
  auth.isSignedIn = false;
});

describe('SignInPrompt', () => {
  it('asks a guest to sign in, in the bar form too', () => {
    render(<SignInPrompt bar />);
    expect(screen.getByText(/^Keep your work\.$/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toMatch(
      /^\/live\/sign-in\/?$/,
    );
  });

  it('shows the prompt until dismissed, then the fallback, and remembers it', () => {
    render(<SignInPrompt fallback={<span>fallback</span>} />);
    expect(screen.getByText('Sign in to keep your content')).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    });
    expect(screen.getByText('fallback')).toBeTruthy();
    expect(window.localStorage.getItem(KEY)).toBe('true');
  });

  it('shows the fallback straight away for a dismissal made earlier', () => {
    window.localStorage.setItem(KEY, 'true');
    render(<SignInPrompt fallback={<span>fallback</span>} />);
    expect(screen.queryByText('Sign in to keep your content')).toBeNull();
    expect(screen.getByText('fallback')).toBeTruthy();
  });

  it('shows only the fallback once signed in, and nothing while the session loads', () => {
    auth.isSignedIn = true;
    render(<SignInPrompt fallback={<span>fallback</span>} />);
    expect(screen.getByText('fallback')).toBeTruthy();
    cleanup();
    auth.authLoaded = false;
    const { container } = render(<SignInPrompt fallback={<span>fallback</span>} />);
    expect(container.textContent).toBe('');
  });
});
