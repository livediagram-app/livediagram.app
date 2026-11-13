// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "Typed-in addresses": the unsubscribe page sends nothing until its button.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailOptOutPage } from './EmailOptOutPage';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

const at = (query: string) => window.history.replaceState(null, '', `/email-optout${query}`);

describe('EmailOptOutPage', () => {
  it('unsubscribes only on the button, through the one-click door', async () => {
    at('?p=plan1&t=tok');
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    render(<EmailOptOutPage />);
    await screen.findByRole('button', { name: 'Unsubscribe' });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }));
    await screen.findByText('You’re Unsubscribed');
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/email-optout\/plan1\/tok$/);
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'POST' });
  });

  it('says a link missing its token, or one the plan never made, does not work', async () => {
    at('?p=plan1');
    render(<EmailOptOutPage />);
    await screen.findByText('This Link Doesn’t Work');
    cleanup();
    at('?p=plan1&t=tok');
    fetchMock.mockResolvedValue(new Response('{}', { status: 404 }));
    render(<EmailOptOutPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Unsubscribe' }));
    await screen.findByText('This Link Doesn’t Work');
  });

  it('offers Try Again when the send fails', async () => {
    at('?p=plan1&t=tok');
    fetchMock.mockRejectedValue(new Error('offline'));
    render(<EmailOptOutPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Unsubscribe' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Try Again' })).toBeTruthy());
  });
});
