// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AccountDeletion, DeletionCodeSent } from '../../lib/account-deletion';

// Each product's docs/specs/014-identity/auth-and-guest-access.md "Deleting an account": the typed email, then the code
// emailed to the account; the server checks the code before anything is deleted, so a wrong one deletes nothing.

const calls: string[] = [];
const session = vi.hoisted(() => ({ fail: false, published: true }));
vi.mock('../providers/deferred-auth', () => ({
  useDeferredAuth: () => ({
    user: { email: 'Ada@Example.com' },
    deleteAccount: session.published
      ? async () => {
          calls.push('session');
          if (session.fail) throw new Error('offline');
        }
      : null,
  }),
}));

import { DeleteAccountDialog } from './DeleteAccountDialog';

afterEach(() => {
  calls.length = 0;
  session.fail = false;
  session.published = true;
});

function open(
  opts: {
    sent?: DeletionCodeSent[];
    results?: (AccountDeletion | Error)[];
  } = {},
) {
  const sent = [...(opts.sent ?? ['sent'])];
  const results = [...(opts.results ?? ['deleted'])];
  const props = {
    onClose: vi.fn(),
    onDeleted: vi.fn(),
    onDataDeleted: vi.fn(() => void calls.push('tracked')),
    sendCode: vi.fn(async () => {
      calls.push('send');
      return sent.shift() ?? 'sent';
    }),
    deleteAccount: vi.fn(async (code: string) => {
      calls.push(`delete ${code}`);
      const next = results.shift() ?? 'deleted';
      if (next instanceof Error) throw next;
      return next;
    }),
  };
  const view = render(
    <DeleteAccountDialog open appName="livediagram" localItems="Canvases" {...props} />,
  );
  return { ...props, view };
}

const emailBox = () => screen.getByRole('textbox', { name: /to confirm/ });
const digitBoxes = () => screen.getAllByRole('textbox', { name: /^Digit/ });
const emailMeACode = () => screen.getByRole('button', { name: 'Email Me a Code' });
const deleteButton = () => screen.getByRole('button', { name: 'Delete Account' });

async function toCodeStep() {
  fireEvent.change(emailBox(), { target: { value: ' ada@example.com ' } });
  fireEvent.click(emailMeACode());
  await screen.findByRole('group', { name: 'Deletion code' });
}

function typeCode(code: string) {
  fireEvent.paste(digitBoxes()[0]!, { clipboardData: { getData: () => code } });
}

describe('DeleteAccountDialog', () => {
  it('says what goes, in every app, before anything else', () => {
    open();
    expect(screen.getByText(/everything you own in every liveworkspace app/)).toBeTruthy();
    expect(screen.getByText(/not just livediagram/)).toBeTruthy();
    expect(screen.getByText(/Canvases in This Browser stay on this device/)).toBeTruthy();
  });

  it('asks for a code only once the email matches, whatever its case', async () => {
    const { sendCode } = open();
    expect((emailMeACode() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(emailBox(), { target: { value: 'someone@else.com' } });
    fireEvent.submit(emailMeACode().closest('form')!);
    expect(sendCode).not.toHaveBeenCalled();
    await toCodeStep();
    expect(sendCode).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/We emailed a 6-digit code to/)).toBeTruthy();
    expect(screen.getByText('Ada@Example.com')).toBeTruthy();
  });

  it('stays on the email step and says why when no code could be sent', async () => {
    open({ sent: ['rate_limited', 'failed'] });
    fireEvent.change(emailBox(), { target: { value: 'ada@example.com' } });
    fireEvent.click(emailMeACode());
    expect((await screen.findByRole('alert')).textContent).toMatch(/Wait a minute/);
    fireEvent.click(emailMeACode());
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/could not send a code/),
    );
    expect(screen.queryByRole('group', { name: 'Deletion code' })).toBeNull();
  });

  it('deletes with the code, then ends the session, then hands over', async () => {
    const { onDeleted, deleteAccount } = open();
    await toCodeStep();
    expect((deleteButton() as HTMLButtonElement).disabled).toBe(true);
    typeCode('123456');
    fireEvent.click(deleteButton());
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(deleteAccount).toHaveBeenCalledWith('123456');
    expect(calls).toEqual(['send', 'delete 123456', 'tracked', 'session']);
  });

  it('deletes nothing on a wrong code, empties the boxes, and lets the person try again', async () => {
    const { onDeleted } = open({ results: ['invalid_code', 'deleted'] });
    await toCodeStep();
    typeCode('000000');
    fireEvent.click(deleteButton());
    expect((await screen.findByRole('alert')).textContent).toMatch(/wrong or has expired/);
    expect(digitBoxes().map((b) => (b as HTMLInputElement).value)).toEqual([
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    expect(digitBoxes()[0]!.getAttribute('aria-invalid')).toBe('true');
    expect(calls).toEqual(['send', 'delete 000000']);
    typeCode('123456');
    expect(digitBoxes()[0]!.getAttribute('aria-invalid')).toBeNull();
    fireEvent.click(deleteButton());
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });

  it.each([
    ['too_many_attempts', /Send a new code/],
    ['rate_limited', /Wait a minute/],
    ['failed', /Could not delete server-side data/],
  ] as const)('says so on %s, keeping the session', async (result, message) => {
    const { onDeleted } = open({ results: [result] });
    await toCodeStep();
    typeCode('123456');
    fireEvent.click(deleteButton());
    expect((await screen.findByRole('alert')).textContent).toMatch(message);
    expect(onDeleted).not.toHaveBeenCalled();
    expect(calls).not.toContain('session');
  });

  it('reads a request that threw as a failure', async () => {
    open({ results: [new Error('offline')] });
    await toCodeStep();
    typeCode('123456');
    fireEvent.click(deleteButton());
    expect((await screen.findByRole('alert')).textContent).toMatch(/Could not delete/);
  });

  it('keeps the session and says so when the data went but the account did not close', async () => {
    const { onDeleted } = open({ results: ['account_not_closed'] });
    await toCodeStep();
    typeCode('123456');
    fireEvent.click(deleteButton());
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /livediagram data was deleted, but closing your liveworkspace account failed/,
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('says to sign out when the data went but ending the session failed', async () => {
    session.fail = true;
    const { onDeleted } = open();
    await toCodeStep();
    typeCode('123456');
    fireEvent.click(deleteButton());
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /signing you out failed: offline\. Sign out to finish/,
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('does nothing until the session can be ended', async () => {
    session.published = false;
    const { deleteAccount } = open();
    await toCodeStep();
    typeCode('123456');
    fireEvent.click(deleteButton());
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('sends a new code on request, and says the old one is gone', async () => {
    const { sendCode } = open({ sent: ['sent', 'sent', 'rate_limited'] });
    await toCodeStep();
    fireEvent.click(screen.getByRole('button', { name: 'Resend Code' }));
    expect((await screen.findByRole('status')).textContent).toMatch(/new code/);
    fireEvent.click(screen.getByRole('button', { name: 'Resend Code' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Wait a minute/);
    expect(sendCode).toHaveBeenCalledTimes(3);
  });

  it('closes on Cancel and Escape, and starts over when opened again', async () => {
    const { onClose, view, ...props } = open();
    await toCodeStep();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    const rerender = (isOpen: boolean) =>
      view.rerender(
        <DeleteAccountDialog
          open={isOpen}
          appName="livediagram"
          localItems="Canvases"
          onClose={onClose}
          {...props}
        />,
      );
    rerender(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(true);
    expect((emailBox() as HTMLInputElement).value).toBe('');
  });

  it('focuses the step’s first field once it opens', async () => {
    vi.useFakeTimers();
    try {
      open();
      act(() => void vi.advanceTimersByTime(50));
      expect(document.activeElement).toBe(emailBox());
    } finally {
      vi.useRealTimers();
    }
  });
});
