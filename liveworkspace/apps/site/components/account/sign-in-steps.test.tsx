// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INVITED_ADDRESS_KEY } from '@/lib/invited-address';
import { SignInFlow } from './SignInFlow';

// The code step and the card after it (Work Tracker 1001), and the invited address filled in (Work Tracker 1006):
// Resend puts focus back in the first box, the signed-in card drops the code step's banners and offers a way on, and
// an address the Explorer's Invites kept for the tab is the form's first value.

function respond(body: unknown = {}, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

let answers: Record<string, () => Promise<Response>>;

beforeEach(() => {
  window.history.replaceState(null, '', '/sign-in');
  sessionStorage.clear();
  answers = {
    '/sign-in-options': () => respond({}),
    '/email-otp/send-verification-otp': () => respond({}),
    '/sign-in/email-otp': () => respond({}),
    '/get-session': () => respond({ user: { givenName: 'Ada' } }),
  };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string) => {
      const path = new URL(input, window.location.href).pathname.replace(/^\/api\/auth/, '');
      return answers[path]?.() ?? respond({}, 404);
    }),
  );
  // The focus after a send waits a frame for the boxes to be enabled again.
  vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) =>
    setTimeout(() => run(0), 0),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));

async function toCodeStep(flow: 'sign-in' | 'sign-up' = 'sign-in') {
  render(<SignInFlow flow={flow} />);
  await settle();
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@example.com' } });
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  await settle();
}

describe('the code step', () => {
  it('puts focus back in the first box after Resend, so the new code can be typed at once', async () => {
    await toCodeStep();
    const resend = screen.getByRole('button', { name: 'Resend code' });
    resend.focus();
    fireEvent.click(resend);
    await settle();
    await settle();
    expect(screen.getByRole('status').textContent).toContain('We sent you a new code.');
    const boxes = screen.getAllByRole('textbox');
    expect(document.activeElement).toBe(boxes[0]);
  });

  it('puts focus back in the first box when Resend fails too', async () => {
    await toCodeStep();
    answers['/email-otp/send-verification-otp'] = () => respond({}, 429);
    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    await settle();
    await settle();
    expect(screen.getByRole('alert').textContent).toMatch(/Too many codes/);
    expect(document.activeElement).toBe(screen.getAllByRole('textbox')[0]);
  });
});

describe('the signed-in card, with nowhere to go back to', () => {
  it('drops the code step’s banner and offers the Explorer and Home', async () => {
    await toCodeStep();
    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    await settle();
    expect(screen.getByText('We sent you a new code.')).toBeTruthy();
    const boxes = screen.getAllByRole('textbox');
    '123456'.split('').forEach((d, i) => fireEvent.change(boxes[i]!, { target: { value: d } }));
    await settle();
    await settle();
    expect(screen.getByRole('heading', { name: "You're signed in" })).toBeTruthy();
    expect(screen.queryByText('We sent you a new code.')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    const links = [...document.querySelectorAll('[data-signed-in-next] a')].map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ]);
    expect(links).toEqual([
      ['Open Explorer', '/explorer'],
      ['Go Home', '/'],
    ]);
  });
});

describe('an invited address', () => {
  it('fills the email field on sign-up and sign-in, and is forgotten once signed in', async () => {
    sessionStorage.setItem(INVITED_ADDRESS_KEY, 'bea@example.com');
    render(<SignInFlow flow="sign-up" />);
    await settle();
    expect(screen.getByLabelText<HTMLInputElement>('Email').value).toBe('bea@example.com');
    cleanup();
    render(<SignInFlow flow="sign-in" />);
    await settle();
    const field = screen.getByLabelText<HTMLInputElement>('Email');
    expect(field.value).toBe('bea@example.com');
    fireEvent.submit(field.closest('form')!);
    await settle();
    const boxes = screen.getAllByRole('textbox');
    '123456'.split('').forEach((d, i) => fireEvent.change(boxes[i]!, { target: { value: d } }));
    await settle();
    await settle();
    expect(sessionStorage.getItem(INVITED_ADDRESS_KEY)).toBeNull();
  });

  it('leaves the field empty without one', async () => {
    render(<SignInFlow flow="sign-in" />);
    await settle();
    expect(screen.getByLabelText<HTMLInputElement>('Email').value).toBe('');
  });
});
