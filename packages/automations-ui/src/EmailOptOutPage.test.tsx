// @vitest-environment jsdom
// liveworkspace/docs/specs/018-automations/automations.md "Send Email": the unsubscribe page sends nothing until its
// button, and says each answer.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendEmailOptOut } from './email-optout';
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
const page = () => (
  <EmailOptOutPage
    app="livediagram"
    item="canvas"
    param="d"
    send={(id, token) => sendEmailOptOut('/api', id, token)}
  />
);

describe('EmailOptOutPage', () => {
  it('unsubscribes only on the button, through the one-click door', async () => {
    at('?d=doc1&t=tok');
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    render(page());
    expect(screen.getByRole('heading').textContent).toBe('Stop Emails From This Canvas’s Rules');
    await screen.findByRole('button', { name: 'Unsubscribe' });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }));
    await screen.findByText('You’re Unsubscribed');
    expect(screen.getByText(/This canvas’s rules won’t email/)).toBeTruthy();
    expect(String(fetchMock.mock.calls[0]![0])).toBe('/api/email-optout/doc1/tok');
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'POST' });
  });

  it('says a link missing its token, or one the item never made, does not work', async () => {
    at('?d=doc1');
    render(page());
    await screen.findByText('This Link Doesn’t Work');
    cleanup();
    at('?d=doc1&t=tok');
    fetchMock.mockResolvedValue(new Response('{}', { status: 404 }));
    render(page());
    fireEvent.click(await screen.findByRole('button', { name: 'Unsubscribe' }));
    await screen.findByText('This Link Doesn’t Work');
  });

  it('offers Try Again when the send fails, or the api errs', async () => {
    at('?d=doc1&t=tok');
    fetchMock.mockRejectedValue(new Error('offline'));
    render(page());
    fireEvent.click(await screen.findByRole('button', { name: 'Unsubscribe' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Try Again' })).toBeTruthy());
    expect(
      await sendEmailOptOut('/api', 'd', 't', async () => new Response('', { status: 500 })),
    ).toBe('error');
  });
});
