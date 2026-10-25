import { describe, expect, it, vi } from 'vitest';
import { type EmailBinding, parseSender, redactAddress, sendEmail } from './index';

const binding = (send: EmailBinding['send']) => ({ send: vi.fn(send) });

describe('sendEmail', () => {
  it('sends through the binding and gives back the message id', async () => {
    const b = binding(async () => ({ messageId: 'm-1' }));
    const id = await sendEmail(b, {
      from: 'liveplanner <hello@liveplanner.app>',
      to: 'jo@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
      unsubscribeUrl: 'https://liveplanner.app/settings',
    });
    expect(id).toBe('m-1');
    expect(b.send).toHaveBeenCalledWith({
      from: { email: 'hello@liveplanner.app', name: 'liveplanner' },
      to: 'jo@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
      headers: { 'List-Unsubscribe': '<https://liveplanner.app/settings>' },
    });
  });

  it('leaves out the headers and text it was not given', async () => {
    const b = binding(async () => ({ messageId: 'm-2' }));
    await sendEmail(b, { from: 'a@b.app', to: 'c@d.app', subject: 's', html: 'h' });
    expect(b.send).toHaveBeenCalledWith({ from: 'a@b.app', to: 'c@d.app', subject: 's', html: 'h' });
  });

  it('passes on a refusal', async () => {
    const refusal = Object.assign(new Error('suppressed'), { code: 'E_RECIPIENT_SUPPRESSED' });
    const b = binding(async () => {
      throw refusal;
    });
    await expect(sendEmail(b, { from: 'a@b.app', to: 'c@d.app', subject: 's', html: 'h' })).rejects.toBe(
      refusal,
    );
  });

  it('gives up on a send that hangs', async () => {
    const b = binding(() => new Promise(() => {}));
    await expect(
      sendEmail(b, { from: 'a@b.app', to: 'c@d.app', subject: 's', html: 'h' }, 20),
    ).rejects.toThrow('timed out after 20 ms');
  });
});

describe('parseSender', () => {
  it('splits a named sender and keeps a bare one', () => {
    expect(parseSender('liveworkspace <sign-in@liveworkspace.app>')).toEqual({
      email: 'sign-in@liveworkspace.app',
      name: 'liveworkspace',
    });
    expect(parseSender('"live diagram" <hello@liveplanner.app>')).toEqual({
      email: 'hello@liveplanner.app',
      name: 'live diagram',
    });
    expect(parseSender(' <x@y.app> ')).toBe('x@y.app');
    expect(parseSender('sign-in@liveplanner.app')).toBe('sign-in@liveplanner.app');
  });

  it('stays linear on a long hostile value', () => {
    const start = performance.now();
    parseSender(`${'<'.repeat(50_000)}a`);
    parseSender(`${' '.repeat(50_000)}<`);
    expect(performance.now() - start).toBeLessThan(200);
  });
});

describe('redactAddress', () => {
  it('keeps the first two characters and the domain', () => {
    expect(redactAddress('jo.smith@example.com')).toBe('jo***@example.com');
    expect(redactAddress('nope')).toBe('***');
  });
});
