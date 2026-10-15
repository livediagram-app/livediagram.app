// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PublicFormResponse } from '@livediagram/api-schema';
import { FormRespondPage } from './FormRespondPage';

// A form link's page (docs/specs/030-forms/forms.md "Filling in a form"): its states, a response sent and each
// refusal said, and Report This Form.

const CODE = 'AbCdEfGhIjKlMnOpQrStU1';
const OPEN: PublicFormResponse = {
  state: 'open',
  backdrop: { light: '#f8fafc', dark: '#0f172a' },
  form: {
    heading: 'Feedback',
    confirmation: 'Thank you!',
    sections: [
      {
        id: 's',
        title: '',
        questions: [{ id: 'q', type: 'short', prompt: 'Thoughts', required: true }],
      },
    ],
  },
};

type Reply = { status: number; body?: unknown };
let replies: Reply[];
let calls: { url: string; init?: RequestInit }[];

beforeEach(() => {
  window.history.replaceState(null, '', `/form/${CODE}`);
  sessionStorage.clear();
  replies = [];
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, ...(init ? { init } : {}) });
      const r = replies.shift() ?? { status: 500 };
      return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
        status: r.status,
      });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const answer = () =>
  fireEvent.change(screen.getByLabelText(/^Thoughts/), { target: { value: 'Great' } });
const submit = () =>
  act(async () => fireEvent.click(screen.getByRole('button', { name: 'Submit' })));

describe('the form page', () => {
  it('shows the form, sends a response and confirms it', async () => {
    replies.push({ status: 200, body: OPEN }, { status: 201, body: { number: 4 } });
    render(<FormRespondPage />);
    await screen.findByRole('heading', { name: 'Feedback' });
    expect(document.title).toBe('Feedback | livediagram');
    answer();
    await submit();
    expect(await screen.findByText('Thank you!')).toBeTruthy();
    expect(calls[1]!.url).toBe(`/api/forms/${CODE}/responses`);
    expect(JSON.parse(String(calls[1]!.init!.body))).toEqual({
      answers: { q: 'Great' },
      other: {},
      website: '',
    });
  });

  it('says a form is not available, or closed with its message', async () => {
    replies.push({ status: 404 });
    render(<FormRespondPage />);
    expect(await screen.findByText('This form isn’t available')).toBeTruthy();
    cleanup();
    replies.push({
      status: 200,
      body: {
        state: 'closed',
        heading: 'Feedback',
        message: 'Back next year.',
        backdrop: OPEN.backdrop,
      },
    });
    render(<FormRespondPage />);
    expect(await screen.findByText('Back next year.')).toBeTruthy();
  });

  it('says an address with no code is not available, without asking', async () => {
    window.history.replaceState(null, '', '/form/placeholder');
    render(<FormRespondPage />);
    expect(await screen.findByText('This form isn’t available')).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it('offers Try Again when the form cannot be read', async () => {
    replies.push({ status: 500 }, { status: 200, body: OPEN });
    render(<FormRespondPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try Again' }));
    expect(await screen.findByRole('heading', { name: 'Feedback' })).toBeTruthy();
  });

  it.each([
    [{ status: 409, body: { error: 'form_closed' } }, 'This form has just closed'],
    [{ status: 413, body: { error: 'form_full' } }, 'This form has just closed'],
    [{ status: 429, body: { error: 'form_busy' } }, 'This form is busy'],
    [{ status: 429 }, 'You’ve sent a lot of responses'],
    [{ status: 502, body: 'x' }, 'We couldn’t send your response'],
    [
      { status: 400, body: { error: 'invalid_answers', errors: { q: 'too_long' } } },
      'Keep it under 200',
    ],
  ])('says why a response was refused (%o)', async (reply, words) => {
    replies.push({ status: 200, body: OPEN }, reply as Reply);
    render(<FormRespondPage />);
    await screen.findByRole('heading', { name: 'Feedback' });
    answer();
    await submit();
    await waitFor(() => expect(document.body.textContent).toContain(words));
  });
});

describe('Report This Form', () => {
  it('files a report with a reason, once per browser', async () => {
    replies.push({ status: 200, body: OPEN }, { status: 201, body: { ok: true } });
    render(<FormRespondPage />);
    await screen.findByRole('heading', { name: 'Feedback' });
    fireEvent.click(screen.getByRole('button', { name: 'Report This Form' }));
    const send = screen.getByRole('button', { name: 'Send Report' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: 'Phishing or Asking for Passwords' }));
    fireEvent.change(screen.getByRole('textbox', { name: /Anything else/ }), {
      target: { value: 'Asks for my bank login' },
    });
    await act(async () => fireEvent.click(send));
    expect(await screen.findByText('Thanks. We’ve recorded your report.')).toBeTruthy();
    const body = JSON.parse(String(calls[1]!.init!.body));
    expect(body).toMatchObject({ reason: 'phishing', note: 'Asks for my bank login' });
    expect(body.browser).toBe(localStorage.getItem('livediagram:form-browser'));
  });

  it('says when a report could not be sent, and Cancel closes it', async () => {
    replies.push({ status: 200, body: OPEN }, { status: 500 });
    render(<FormRespondPage />);
    await screen.findByRole('heading', { name: 'Feedback' });
    fireEvent.click(screen.getByRole('button', { name: 'Report This Form' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Spam' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send Report' })));
    expect(await screen.findByText('We couldn’t send your report. Try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Send Report' })).toBeNull();
  });
});
