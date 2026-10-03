// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/clerk-config', () => ({ clerkEnabled: false, sessionsEnabled: false }));
vi.mock('@/components/providers/deferred-auth', () => ({ useDeferredAuth: () => ({}) }));
vi.mock('@/components/chrome/auth-shared', () => ({ useAuthHrefs: () => ({}) }));

const { SignInPrompt } = await import('./SignInPrompt');

const KEY = 'livediagram:v2:signin-prompt-dismissed';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('SignInPrompt', () => {
  it('shows the prompt until dismissed, then the fallback, and remembers it', () => {
    render(<SignInPrompt fallback={<span>fallback</span>} />);
    expect(screen.getByText('Documents saved to this browser')).toBeTruthy();
    act(() => fireEvent.click(screen.getByRole('button')));
    expect(screen.getByText('fallback')).toBeTruthy();
    expect(window.localStorage.getItem(KEY)).toBe('true');
  });

  it('shows the fallback straight away for a dismissal made earlier', () => {
    window.localStorage.setItem(KEY, 'true');
    render(<SignInPrompt fallback={<span>fallback</span>} />);
    expect(screen.queryByText('Documents saved to this browser')).toBeNull();
    expect(screen.getByText('fallback')).toBeTruthy();
  });
});
