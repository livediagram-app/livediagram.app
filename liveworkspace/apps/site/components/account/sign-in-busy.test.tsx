// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignInFlow } from './SignInFlow';

// Busy until the page leaves (liveworkspace/docs/specs/010-site/site.md "Accounts", busy-buttons.md): Verify keeps
// saying it is working through the session check and the continue that follow the code, not only the code's own
// request, and Back into the kept page makes it pressable again.

type Answer = { status?: number; body?: unknown };
let pending: Map<string, (answer: Answer) => void>;

function respond(answer: Answer) {
  return new Response(JSON.stringify(answer.body ?? {}), { status: answer.status ?? 200 });
}

beforeEach(() => {
  window.history.replaceState(null, '', '/sign-in?return=%2Fexplorer');
  pending = new Map();
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string) => {
      const path = new URL(input, window.location.href).pathname.replace(/^\/api\/auth/, '');
      if (path === '/sign-in-options') return Promise.resolve(respond({}));
      if (path === '/email-otp/send-verification-otp') return Promise.resolve(respond({}));
      // The rest wait for the test to answer them, one at a time.
      return new Promise<Response>((resolve) => {
        pending.set(path, (answer) => resolve(respond(answer)));
      });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));

async function answer(path: string, given: Answer = {}) {
  await vi.waitFor(() => expect(pending.has(path)).toBe(true));
  const reply = pending.get(path)!;
  pending.delete(path);
  await act(async () => reply(given));
  await settle();
}

async function toCodeStep() {
  render(<SignInFlow flow="sign-in" />);
  await settle();
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@example.com' } });
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  await settle();
  const boxes = screen.getAllByRole('textbox');
  '123456'.split('').forEach((d, i) => fireEvent.change(boxes[i]!, { target: { value: d } }));
  await settle();
}

const verifyButton = () => screen.getByRole('button', { name: /^(Verify|Verifying…)$/ });

describe('SignInFlow busy until it leaves', () => {
  it('stays busy after the code is accepted, while the session check is still out', async () => {
    await toCodeStep();
    expect(verifyButton().textContent).toBe('Verifying…');
    await answer('/sign-in/email-otp', { body: {} });
    // The code's request is done, the page has not left: still busy.
    expect(verifyButton().textContent).toBe('Verifying…');
    expect(verifyButton()).toHaveProperty('disabled', true);
  });

  it('lets go when the code is wrong', async () => {
    await toCodeStep();
    await answer('/sign-in/email-otp', { status: 401, body: {} });
    expect(screen.getByRole('alert').textContent).toMatch(/wrong or has expired/);
    expect(verifyButton().textContent).toBe('Verify');
  });

  it('lets go when Back brings the page out of the browser cache', async () => {
    await toCodeStep();
    await answer('/sign-in/email-otp', { body: {} });
    const event = new Event('pageshow') as PageTransitionEvent;
    Object.defineProperty(event, 'persisted', { value: true });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(verifyButton().textContent).toBe('Verify');
  });
});
