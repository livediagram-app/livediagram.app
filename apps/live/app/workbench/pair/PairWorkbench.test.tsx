// @vitest-environment jsdom
// The pairing page (docs/specs/013-workspace/workbench-embeds.md "Pairing"; blueprint "The pairing page"): every
// state and its copy, the one read after auth settles, the answer, and focus on the heading at each state.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorkbenchPairingRequestView } from '@livediagram/api-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
  clerk: true,
  authLoaded: true,
  signedIn: true,
  query: 'code=AAAAAAAAAAAAAAAAAAAAAA',
}));
vi.mock('@/lib/clerk-config', () => ({
  get sessionsEnabled() {
    return env.clerk;
  },
}));
vi.mock('@/hooks/persistence/useClerkApiBootstrap', () => ({
  useClerkApiBootstrap: () => ({
    authLoaded: env.authLoaded,
    isSignedIn: env.signedIn,
    clerkUserId: env.signedIn ? 'user_1' : null,
  }),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(env.query) }));
const api = vi.hoisted(() => ({
  apiReadPairingRequest: vi.fn(),
  apiAnswerPairingRequest: vi.fn(),
}));
vi.mock('@/lib/api-client', () => api);
const telemetry = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => telemetry);

import { PairWorkbench } from './PairWorkbench';

const CODE = 'AAAAAAAAAAAAAAAAAAAAAA';
const REQUEST: WorkbenchPairingRequestView = {
  origin: 'https://127.0.0.1:5175',
  name: 'Acme Editor',
  tokenName: 'livediagram CLI',
  expiresAt: Date.now() + 600_000,
  status: 'pending',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const heading = () => screen.getByRole('heading', { level: 1 });

beforeEach(() => {
  window.history.replaceState(null, '', `/workbench/pair?${env.query}`);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  Object.assign(env, { clerk: true, authLoaded: true, signedIn: true, query: `code=${CODE}` });
});

describe('the pairing route', () => {
  it('is a static page, kept out of search, holding the page in a Suspense boundary', async () => {
    const { default: Page, metadata } = await import('./page');
    expect(metadata.robots).toEqual({ index: false });
    api.apiReadPairingRequest.mockResolvedValue(REQUEST);
    render(<Page />);
    expect(await screen.findByRole('heading', { name: 'Allow this workbench?' })).toBeTruthy();
  });
});

describe('PairWorkbench', () => {
  it('says pairing is not available when accounts are off', () => {
    env.clerk = false;
    render(<PairWorkbench />);
    expect(heading().textContent).toBe('Workbenches aren’t available');
    expect(
      screen.getByText(
        'This deployment doesn’t have accounts enabled, so there’s nothing to pair.',
      ),
    ).toBeTruthy();
    expect(api.apiReadPairingRequest).not.toHaveBeenCalled();
  });

  it('shows loading, with no request, until auth settles', () => {
    env.authLoaded = false;
    render(<PairWorkbench />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(api.apiReadPairingRequest).not.toHaveBeenCalled();
  });

  it('asks a signed-out visitor to sign in and come back to this path and query', () => {
    env.signedIn = false;
    render(<PairWorkbench />);
    expect(heading().textContent).toBe('Sign in to approve this workbench');
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe(
      `/sign-in/?redirect_url=${encodeURIComponent(`/workbench/pair?code=${CODE}`)}`,
    );
    expect(api.apiReadPairingRequest).not.toHaveBeenCalled();
  });

  it('cannot find a request without a code, and asks nothing of the api', () => {
    env.query = '';
    render(<PairWorkbench />);
    expect(heading().textContent).toBe('We couldn’t find this request');
    expect(
      screen.getByText(
        'It may belong to another account. Check you’re signed in as the person who runs the workbench.',
      ),
    ).toBeTruthy();
    expect(api.apiReadPairingRequest).not.toHaveBeenCalled();
  });

  it('cannot find a request whose code is malformed', () => {
    env.query = 'code=not-a-code';
    render(<PairWorkbench />);
    expect(heading().textContent).toBe('We couldn’t find this request');
    expect(api.apiReadPairingRequest).not.toHaveBeenCalled();
  });

  it('cannot find a request the api does not know, or that is another account’s', async () => {
    api.apiReadPairingRequest.mockResolvedValue(null);
    render(<PairWorkbench />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(
      await screen.findByRole('heading', { name: 'We couldn’t find this request' }),
    ).toBeTruthy();
    expect(api.apiReadPairingRequest).toHaveBeenCalledTimes(1);
    expect(api.apiReadPairingRequest).toHaveBeenCalledWith('user_1', CODE);
  });

  it('reads a failed request as not found, and logs it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    api.apiReadPairingRequest.mockRejectedValue(new Error('offline'));
    render(<PairWorkbench />);
    expect(
      await screen.findByRole('heading', { name: 'We couldn’t find this request' }),
    ).toBeTruthy();
    expect(warn).toHaveBeenCalledWith('[workbench] pairing-read-failed');
  });

  it('asks to allow a named workbench at its origin with the token named', async () => {
    api.apiReadPairingRequest.mockResolvedValue(REQUEST);
    render(<PairWorkbench />);
    expect(await screen.findByRole('heading', { name: 'Allow this workbench?' })).toBeTruthy();
    const question = screen.getByText(/to open your documents with the token/);
    expect(question.textContent).toBe(
      'Allow Acme Editor at https://127.0.0.1:5175 to open your documents with the token livediagram CLI?',
    );
    expect(question.querySelector('code')?.textContent).toBe('https://127.0.0.1:5175');
    expect([...question.querySelectorAll('strong')].map((s) => s.textContent)).toEqual([
      'Acme Editor',
      'livediagram CLI',
    ]);
    expect(
      screen.getByText(
        'It opens one document at a time, as you, inside that tool. You can unpair it any time in Settings, under API Tokens.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Allow' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Don’t allow' })).toBeTruthy();
  });

  it('asks about an unnamed workbench and an unnamed token', async () => {
    api.apiReadPairingRequest.mockResolvedValue({ ...REQUEST, name: null, tokenName: null });
    render(<PairWorkbench />);
    await screen.findByRole('heading', { name: 'Allow this workbench?' });
    expect(screen.getByText(/to open your documents with/).textContent).toBe(
      'Allow a workbench at https://127.0.0.1:5175 to open your documents with an unnamed token?',
    );
  });

  it('says the request expired when it is read as expired', async () => {
    api.apiReadPairingRequest.mockResolvedValue({ ...REQUEST, status: 'expired' });
    render(<PairWorkbench />);
    expect(await screen.findByRole('heading', { name: 'This request has expired' })).toBeTruthy();
    const body = screen.getByText(/to ask anew/);
    expect(body.textContent).toBe('Run livediagram workbench pair again to ask anew.');
    expect(body.querySelector('code')?.textContent).toBe('livediagram workbench pair');
  });

  it.each(['approved', 'declined'] as const)(
    'says a request read as %s was already answered',
    async (status) => {
      api.apiReadPairingRequest.mockResolvedValue({ ...REQUEST, status });
      render(<PairWorkbench />);
      expect(
        await screen.findByRole('heading', { name: 'This request was already answered' }),
      ).toBeTruthy();
      const body = screen.getByText(/if you need to ask anew/);
      expect(body.textContent).toBe(
        'Run livediagram workbench pair again if you need to ask anew.',
      );
      expect(body.querySelector('code')?.textContent).toBe('livediagram workbench pair');
    },
  );

  it('allows: working while it asks, then allowed, counted once', async () => {
    api.apiReadPairingRequest.mockResolvedValue(REQUEST);
    const answer = deferred<string>();
    api.apiAnswerPairingRequest.mockReturnValue(answer.promise);
    render(<PairWorkbench />);
    fireEvent.click(await screen.findByRole('button', { name: 'Allow' }));

    const allowing = screen.getByRole('button', { name: 'Allowing…' }) as HTMLButtonElement;
    expect(allowing.disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Don’t allow' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(heading().textContent).toBe('Allow this workbench?');
    expect(api.apiAnswerPairingRequest).toHaveBeenCalledWith('user_1', CODE, 'approve');

    await act(async () => answer.resolve('approved'));
    expect(heading().textContent).toBe('Workbench allowed');
    expect(screen.getByText('Return to Acme Editor; it carries on by itself.')).toBeTruthy();
    expect(telemetry.track).toHaveBeenCalledTimes(1);
    expect(telemetry.track).toHaveBeenCalledWith('Token', 'Linked', 'Workbench');
  });

  it('sends an unnamed workbench back to “your workbench” once allowed', async () => {
    api.apiReadPairingRequest.mockResolvedValue({ ...REQUEST, name: null });
    api.apiAnswerPairingRequest.mockResolvedValue('approved');
    render(<PairWorkbench />);
    fireEvent.click(await screen.findByRole('button', { name: 'Allow' }));
    expect(
      await screen.findByText('Return to your workbench; it carries on by itself.'),
    ).toBeTruthy();
  });

  it('declines: both disabled while it asks, then not allowed, and nothing counted', async () => {
    api.apiReadPairingRequest.mockResolvedValue(REQUEST);
    const answer = deferred<string>();
    api.apiAnswerPairingRequest.mockReturnValue(answer.promise);
    render(<PairWorkbench />);
    fireEvent.click(await screen.findByRole('button', { name: 'Don’t allow' }));

    expect((screen.getByRole('button', { name: 'Allow' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole('button', { name: 'Don’t allow' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(api.apiAnswerPairingRequest).toHaveBeenCalledWith('user_1', CODE, 'decline');

    await act(async () => answer.resolve('declined'));
    expect(heading().textContent).toBe('Workbench not allowed');
    expect(screen.getByText('Nothing was paired. Your terminal will stop waiting.')).toBeTruthy();
    expect(telemetry.track).not.toHaveBeenCalled();
  });

  it.each([
    ['answered', 'This request was already answered'],
    ['expired', 'This request has expired'],
    ['missing', 'We couldn’t find this request'],
  ] as const)('reads an answer refused as %s', async (outcome, title) => {
    api.apiReadPairingRequest.mockResolvedValue(REQUEST);
    api.apiAnswerPairingRequest.mockResolvedValue(outcome);
    render(<PairWorkbench />);
    fireEvent.click(await screen.findByRole('button', { name: 'Allow' }));
    expect(await screen.findByRole('heading', { name: title })).toBeTruthy();
    expect(telemetry.track).not.toHaveBeenCalled();
  });

  it('fails in place with an alert, and lets the person try again', async () => {
    api.apiReadPairingRequest.mockResolvedValue(REQUEST);
    api.apiAnswerPairingRequest.mockRejectedValueOnce(new Error('500'));
    render(<PairWorkbench />);
    fireEvent.click(await screen.findByRole('button', { name: 'Allow' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Something went wrong. Please try again.',
    );
    expect(heading().textContent).toBe('Allow this workbench?');
    const allow = screen.getByRole('button', { name: 'Allow' }) as HTMLButtonElement;
    expect(allow.disabled).toBe(false);

    api.apiAnswerPairingRequest.mockResolvedValueOnce('approved');
    fireEvent.click(allow);
    expect(await screen.findByRole('heading', { name: 'Workbench allowed' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reads the request once, however often it renders', async () => {
    api.apiReadPairingRequest.mockResolvedValue(REQUEST);
    const { rerender } = render(<PairWorkbench />);
    await screen.findByRole('heading', { name: 'Allow this workbench?' });
    rerender(<PairWorkbench />);
    await waitFor(() => expect(api.apiReadPairingRequest).toHaveBeenCalledTimes(1));
  });

  it.each([
    ['resolves', (d: ReturnType<typeof deferred<unknown>>) => d.resolve(REQUEST)],
    ['fails', (d: ReturnType<typeof deferred<unknown>>) => d.reject(new Error('offline'))],
  ])('drops a read that %s after the page is gone', async (_how, settle) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const read = deferred<unknown>();
    api.apiReadPairingRequest.mockReturnValue(read.promise);
    const { unmount } = render(<PairWorkbench />);
    unmount();
    await act(async () => settle(read));
    expect(document.querySelector('h1')).toBeNull();
  });

  it('keeps focus where it is when nothing changed state', async () => {
    api.apiReadPairingRequest.mockResolvedValue(REQUEST);
    const { rerender } = render(<PairWorkbench />);
    await screen.findByRole('heading', { name: 'Allow this workbench?' });
    const allow = screen.getByRole('button', { name: 'Allow' });
    allow.focus();
    rerender(<PairWorkbench />);
    expect(document.activeElement).toBe(allow);
  });

  it('moves focus to the heading on each state change', async () => {
    api.apiReadPairingRequest.mockResolvedValue(REQUEST);
    api.apiAnswerPairingRequest.mockRejectedValueOnce(new Error('500'));
    render(<PairWorkbench />);
    await screen.findByRole('heading', { name: 'Allow this workbench?' });
    expect(document.activeElement).toBe(heading());

    const allow = screen.getByRole('button', { name: 'Allow' });
    allow.focus();
    fireEvent.click(allow);
    await screen.findByRole('alert');
    expect(document.activeElement).toBe(heading());

    api.apiAnswerPairingRequest.mockResolvedValueOnce('declined');
    fireEvent.click(screen.getByRole('button', { name: 'Don’t allow' }));
    await screen.findByRole('heading', { name: 'Workbench not allowed' });
    expect(document.activeElement).toBe(heading());
  });
});
