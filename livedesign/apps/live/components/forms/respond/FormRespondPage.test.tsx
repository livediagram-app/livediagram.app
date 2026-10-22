// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sentJson } from '@livedesign/vitest-config/sent-request';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PublicFormResponse } from '@livedesign/api-schema';
import { formLook } from '@livedesign/document';
import { FormRespondPage } from './FormRespondPage';

// A form link's page (docs/specs/030-forms/forms.md "Filling in a form"): its states, a response sent and each
// refusal said, and Report This Form.

const CODE = 'AbCdEfGhIjKlMnOpQrStU1';
const OPEN: PublicFormResponse = {
  state: 'open',
  look: formLook({ theme: 'forest', finish: 'sketch', font: 'caveat' }),
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
  // docs/specs/030-forms/forms.md "Look": the tab's canvas style is behind the form, as in the builder.
  it('draws the tab’s canvas style behind the form, and none without one', async () => {
    const look = formLook({
      theme: 'forest',
      backgroundPattern: 'aurora',
      patternColor: '#ff0000',
    });
    replies.push({ status: 200, body: { ...OPEN, look } });
    render(<FormRespondPage />);
    await screen.findByRole('heading', { name: 'Feedback' });
    const moving = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-animated-pattern="aurora"]');
      expect(el).not.toBeNull();
      return el!;
    });
    expect(moving.style.getPropertyValue('--lvd-pat')).toBe('#ff0000');
    expect(moving.closest('[data-tab-pattern-layer]')!.className).toContain('fixed');
    cleanup();
    replies.push({ status: 200, body: OPEN });
    render(<FormRespondPage />);
    await screen.findByRole('heading', { name: 'Feedback' });
    expect(document.querySelector('[data-tab-pattern-layer]')).toBeNull();
  });

  it('shows the form, sends a response and confirms it', async () => {
    replies.push({ status: 200, body: OPEN }, { status: 201, body: { number: 4 } });
    render(<FormRespondPage />);
    await screen.findByRole('heading', { name: 'Feedback' });
    // The title is set in an effect, which can flush after the heading paints when the machine is busy.
    await waitFor(() => expect(document.title).toBe('Feedback | livedesign'));
    // The tab's look dresses the page: its finish, font and colour.
    const main = document.querySelector('main')!;
    expect(main.getAttribute('data-form-finish')).toBe('sketch');
    expect(main.style.fontFamily).toContain('Caveat');
    expect(main.style.getPropertyValue('--form-accent-light')).toBe(OPEN.look.accent.light);
    answer();
    await submit();
    expect(await screen.findByText('Thank you!')).toBeTruthy();
    expect(calls[1]!.url).toBe(`/api/forms/${CODE}/responses`);
    expect(sentJson(calls[1]!.init)).toEqual({
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
        look: OPEN.look,
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
    [{ status: 500, body: { error: 'internal_error' } }, 'We couldn’t send your response'],
    [{ status: 418, body: { error: 'teapot' } }, 'We couldn’t send your response'],
    [
      { status: 400, body: { error: 'invalid_answers', errors: { q: 'too_long' } } },
      'Keep it under 200',
    ],
  ])('says why a response was refused (%o)', async (reply, words) => {
    replies.push({ status: 200, body: OPEN }, reply);
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
    const body = sentJson(calls[1]!.init) as Record<string, unknown>;
    expect(body).toMatchObject({ reason: 'phishing', note: 'Asks for my bank login' });
    expect(body.browser).toBe(localStorage.getItem('livedesign:form-browser'));
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
