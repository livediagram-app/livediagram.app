// @vitest-environment jsdom
// What a refusal says in the account panels and Settings (liveworkspace/docs/specs/022-interface-design/error-words.md):
// each package's own words first, then the class's; Try Again only where it can help; an offline read runs again by
// itself once back online.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { webhookError } from '../connections/connections-api';
import { bearerSettingsRequest } from '../request';
import { settingsApiErrorMessage } from '../store';
import { ErrorNote } from './error-note';
import { accountErrorMessage } from './errors';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const offline = () => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

describe('the fallbacks', () => {
  it('keep their own words, then say the class, and the plain line only when nothing explains it', () => {
    expect(accountErrorMessage('name_required')).toBe('Give it a name.');
    expect(accountErrorMessage('forbidden')).toBe(
      'You don’t have access to that. Ask its owner for access.',
    );
    expect(accountErrorMessage('server_error')).toBe(
      'Something went wrong on our side. Try again in a moment.',
    );
    expect(accountErrorMessage('boom', 502)).toBe(
      'Something went wrong on our side. Try again in a moment.',
    );
    expect(accountErrorMessage('boom')).toBe('Something went wrong. Try again.');
    expect(settingsApiErrorMessage('conflict')).toBe(
      'That changed somewhere else just now. Refresh to see the latest, then try again.',
    );
    expect(settingsApiErrorMessage('boom', 404)).toBe(
      'That’s no longer there. It may have been moved or deleted.',
    );
    expect(webhookError('rate_limited')).toBe(
      'Too many tries just now. Wait a minute and try again.',
    );
  });

  it('say offline, not "couldn’t reach", while the browser is offline', () => {
    expect(accountErrorMessage('offline')).toBe(
      'Couldn’t reach liveworkspace. Check your connection and try again.',
    );
    offline();
    expect(accountErrorMessage('offline')).toBe('You’re offline. Reconnect, then try again.');
    expect(settingsApiErrorMessage('offline')).toBe('You’re offline. Reconnect, then try again.');
  });
});

describe('bearerSettingsRequest', () => {
  it('names a refusal with no code of its own by its status', async () => {
    const answers = [401, 403, 404, 409, 429, 503, 418];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: answers.shift()! })),
    );
    const request = bearerSettingsRequest({ baseUrl: '/api', token: async () => 'tok' });
    const errors = [];
    for (let i = 0; i < 7; i++) {
      const result = await request('/x');
      errors.push(result.ok ? null : result.error);
    }
    expect(errors).toEqual([
      'signed_out',
      'forbidden',
      'not_found',
      'conflict',
      'rate_limited',
      'server_error',
      'failed',
    ]);
  });
});

describe('ErrorNote', () => {
  it('offers Try Again for a refusal that can be retried', () => {
    const onSelect = vi.fn();
    render(
      <ErrorNote error="server_error" action={{ label: 'Try Again', onSelect }}>
        {accountErrorMessage('server_error')}
      </ErrorNote>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it.each(['signed_out', 'forbidden', 'not_found'])(
    'offers no Try Again when %s, since it could only fail the same way',
    (error) => {
      render(
        <ErrorNote error={error} action={{ label: 'Try Again', onSelect: vi.fn() }}>
          {accountErrorMessage(error)}
        </ErrorNote>,
      );
      expect(screen.getByRole('alert').textContent).toBe(accountErrorMessage(error));
      expect(screen.queryByRole('button', { name: 'Try Again' })).toBeNull();
    },
  );

  it('keeps Try Again when it is given no error', () => {
    render(<ErrorNote action={{ label: 'Try Again', onSelect: vi.fn() }}>Not reset.</ErrorNote>);
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeTruthy();
  });

  it('says a read is offline and runs it again by itself once back online', () => {
    const onLine = offline();
    const onSelect = vi.fn();
    render(
      <ErrorNote error="offline" action={{ label: 'Try Again', onSelect }}>
        {accountErrorMessage('offline')}
      </ErrorNote>,
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'You’re offline. It tries again when you reconnect.',
    );
    expect(screen.queryByRole('button', { name: 'Try Again' })).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
    onLine.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
