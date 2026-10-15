// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthCard } from './auth-shared';

afterEach(cleanup);

// A resent code is good news: it reads as a status, never in the error box, and an error wins over it.
describe('AuthCard messages', () => {
  it('shows a notice as a status, not an alert', () => {
    render(
      <AuthCard subtitle="Sign in" error="" notice="A new code has been sent. Check your email.">
        <span />
      </AuthCard>,
    );
    expect(screen.getByRole('status').textContent).toContain('A new code has been sent');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows an error, and not the notice beside it', () => {
    render(
      <AuthCard subtitle="Sign in" error="Incorrect code" notice="A new code has been sent.">
        <span />
      </AuthCard>,
    );
    expect(screen.getByRole('alert').textContent).toBe('Incorrect code');
    expect(screen.queryByText('A new code has been sent.')).toBeNull();
  });
});
