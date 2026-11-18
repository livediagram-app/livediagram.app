// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INVITED_ADDRESS_KEY } from '@/lib/invited-address';
import { SignInFlow } from './SignInFlow';

// The code step (Work Tracker 1001), the end of a sign-in with nowhere to go back to (Work Tracker 1063), and the
// invited address filled in (Work Tracker 1006): Resend puts focus back in the first box, a sign-in or registration
// opened at the page itself goes on to the Explorer Home while one from an app or a page still goes back, and an
// address the Explorer's Invites kept for the tab is the form's first value.

function respond(body: unknown = {}, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

let answers: Record<string, () => Promise<Response>>;
// The page leaves with location.assign, which jsdom can't follow: recorded instead, the rest of the address live.
let assign: ReturnType<typeof vi.fn>;

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
  assign = vi.fn();
  const real = window.location;
  const live = Object.create(null) as Location;
  for (const key of ['href', 'origin', 'host', 'hostname', 'pathname', 'search', 'hash'] as const)
    Object.defineProperty(live, key, { get: () => real[key] });
  Object.defineProperty(live, 'assign', { get: () => assign });
  vi.spyOn(window, 'location', 'get').mockReturnValue(live);
  // The focus after a send waits a frame for the boxes to be enabled again.
  vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) =>
    setTimeout(() => run(0), 0),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

describe('the end of a sign-in, with nowhere to go back to', () => {
  async function signIn(flow: 'sign-in' | 'sign-up' = 'sign-in') {
    render(<SignInFlow flow={flow} />);
    await settle();
    if (flow === 'sign-up') {
      fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
      fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Lovelace' } });
    }
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@example.com' } });
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
    await settle();
    const boxes = screen.getAllByRole('textbox');
    '123456'.split('').forEach((d, i) => fireEvent.change(boxes[i]!, { target: { value: d } }));
    await settle();
    await settle();
  }

  it('goes straight on to the Explorer Home from /sign-in, with no card telling the person to close the tab', async () => {
    await signIn();
    expect(assign).toHaveBeenCalledWith('/explorer');
    expect(screen.queryByRole('heading', { name: "You're signed in" })).toBeNull();
    expect(document.body.textContent).not.toMatch(/close this tab|go back to the app/);
  });

  it('goes on to the Explorer Home after registering at /sign-up too', async () => {
    window.history.replaceState(null, '', '/sign-up');
    await signIn('sign-up');
    expect(assign).toHaveBeenCalledWith('/explorer');
  });

  it('goes on to the Explorer Home once a nameless account is given its name', async () => {
    answers['/get-session'] = () => respond({ user: {} });
    answers['/update-user'] = () => respond({});
    await signIn();
    expect(screen.getByRole('heading', { name: "What's your name?" })).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Lovelace' } });
    fireEvent.submit(screen.getByLabelText('First name').closest('form')!);
    await settle();
    expect(assign).toHaveBeenCalledWith('/explorer');
  });

  it('still goes back to the page the header’s Sign in came from', async () => {
    window.history.replaceState(null, '', '/sign-in?return=%2Ftelemetry');
    await signIn();
    expect(assign).toHaveBeenCalledWith('/telemetry');
  });

  // CodeQL's client-side redirect alert on this path: a `return` that would leave the site is ignored (returnPath),
  // so the sign-in lands on the Explorer Home instead of the hostile address.
  it.each([
    ['//evil.example', '%2F%2Fevil.example'],
    ['https://evil.example', 'https%3A%2F%2Fevil.example'],
    ['javascript:alert(1)', 'javascript%3Aalert(1)'],
    ['/\\evil.example', '%2F%5Cevil.example'],
    ['/<tab>/evil.example', '%2F%09%2Fevil.example'],
  ])('ignores a return of %s and goes on to the Explorer Home', async (_, encoded) => {
    window.history.replaceState(null, '', `/sign-in?return=${encoded}`);
    await signIn();
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/explorer');
  });

  it('still goes back to the app when the sign-in came from one', async () => {
    answers['/sign-in/email-otp'] = () =>
      respond({ url: 'https://livediagram.app/auth/callback?code=c' });
    await signIn();
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalledWith('/explorer');
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
