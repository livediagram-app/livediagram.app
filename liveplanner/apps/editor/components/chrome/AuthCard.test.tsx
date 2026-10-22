// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MIDNIGHT_PALETTE } from '@/hooks/ui/useMidnightPalette';
import { AuthCard, RedirectingCard } from './auth-shared';
import { ACCOUNT_PITCH_ROWS } from './auth-pitches';

afterEach(cleanup);

// A resent code is good news: it reads as a status, never in the error box, and an error wins over it.
describe('AuthCard messages', () => {
  it('shows a notice as a status, not an alert', () => {
    render(
      <AuthCard
        title="Check your email"
        error=""
        notice="A new code has been sent. Check your email."
      >
        <span />
      </AuthCard>,
    );
    expect(screen.getByRole('status').textContent).toContain('A new code has been sent');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows an error, and not the notice beside it', () => {
    render(
      <AuthCard title="Check your email" error="Incorrect code" notice="A new code has been sent.">
        <span />
      </AuthCard>,
    );
    expect(screen.getByRole('alert').textContent).toBe('Incorrect code');
    expect(screen.queryByText('A new code has been sent.')).toBeNull();
  });
});

// docs/specs/014-identity/auth-and-guest-access.md "The look: Night Band".
describe('AuthCard on the Night Band frame', () => {
  it('titles the page with its one h1, and the pitch with an h2', () => {
    render(
      <AuthCard title="Welcome back" subtitle="Sign in to keep your projects." error="">
        <span />
      </AuthCard>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Welcome back');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain(
      'An account is optional',
    );
  });

  it('puts the form before the pitch, so Tab and a screen reader reach it first', () => {
    render(
      <AuthCard title="Welcome back" error="">
        <input aria-label="Email" />
      </AuthCard>,
    );
    const field = screen.getByLabelText('Email');
    const pitch = screen.getByText(ACCOUNT_PITCH_ROWS[0]!.line);
    expect(field.compareDocumentPosition(pitch) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('drops the pitch when asked (interstitials, guest-only notice)', () => {
    render(
      <AuthCard title="Signing you in" error="" pitch={false}>
        <span />
      </AuthCard>,
    );
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('offers the guest way out only when given somewhere to go', () => {
    const { rerender } = render(
      <AuthCard title="Welcome back" error="" guestHref="/d/abc">
        <span />
      </AuthCard>,
    );
    expect(screen.getByRole('link', { name: /keep going as a guest/i }).getAttribute('href')).toBe(
      '/d/abc',
    );
    rerender(
      <AuthCard title="Welcome back" error="">
        <span />
      </AuthCard>,
    );
    expect(screen.queryByRole('link', { name: /guest/i })).toBeNull();
  });

  it('wears Midnight in dark mode while mounted, and gives it back after', () => {
    const { unmount } = render(<RedirectingCard />);
    expect(document.documentElement.dataset.palette).toBe(MIDNIGHT_PALETTE);
    unmount();
    expect(document.documentElement.dataset.palette).toBeUndefined();
  });
});
