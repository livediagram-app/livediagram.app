import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { readInboundMail } from './index';

const enc = new TextEncoder();
const opts = { trustedAuthServIds: ['mx.cloudflare.net'], envelopeFrom: 'ada@example.com' };
const read = (lines: string[]) => readInboundMail(enc.encode(lines.join('\r\n')), opts);

const AUTH = 'Authentication-Results: mx.cloudflare.net; dkim=pass; spf=pass; dmarc=pass';

describe('readInboundMail', () => {
  it('reads a plain message', () => {
    const mail = read([
      AUTH,
      'Authentication-Results: mx.cloudflare.net; dmarc=fail',
      'From: "Ada" <Ada@Example.com>',
      'Subject:  Printer   on floor 3',
      '  is broken',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      'It jams caf=C3=A9 =',
      'every time.   ',
      '    indented',
    ]);
    expect(mail).toEqual({
      from: 'ada@example.com',
      subject: 'Printer on floor 3 is broken',
      text: 'It jams café every time.\n    indented',
      attachments: [],
      authentication: { verdict: 'pass', reason: 'dmarc_pass' },
    });
  });

  it('prefers the plain part and keeps attachments with their names', () => {
    const mail = read([
      AUTH,
      'From: ada@example.com',
      'Subject: =?UTF-8?B?Q2Fmw6k=?=',
      'Content-Type: multipart/mixed; boundary=b',
      '',
      '--b',
      'Content-Type: multipart/alternative; boundary=c',
      '',
      '--c',
      'Content-Type: text/plain',
      '',
      'Plain body',
      '--c',
      'Content-Type: text/html',
      '',
      '<p>HTML body</p>',
      '--c--',
      '--b',
      'Content-Type: image/png',
      'Content-Disposition: attachment; filename="=?utf-8?Q?sh=C3=B6t.png?="',
      'Content-Transfer-Encoding: base64',
      '',
      'AQID',
      '--b',
      'Content-Type: application/pdf',
      'Content-Disposition: attachment',
      '',
      'pdf',
      '--b',
      'Content-Type: text/plain; name=notes.txt',
      '',
      'second text',
      '--b',
      'Content-Type: message/rfc822',
      '',
      'Subject: inner',
      '--b',
      'Content-Type: text/plain',
      '',
      'a later text part, not the body',
      '--b',
      'Content-Type: text/html',
      '',
      '<p>a later html part</p>',
      '--b--',
    ]);
    expect(mail.subject).toBe('Café');
    expect(mail.text).toBe('Plain body');
    expect(mail.attachments.map((a) => [a.name, a.type, a.bytes.length])).toEqual([
      ['shöt.png', 'image/png', 3],
      ['attachment', 'application/pdf', 3],
      ['notes.txt', 'text/plain', 11],
      ['attachment', 'message/rfc822', 14],
    ]);
    expect([...mail.attachments[0]!.bytes]).toEqual([1, 2, 3]);
  });

  it('reads an HTML-only message as text', () => {
    const latin1 = [
      'From: ada@example.com',
      'Content-Type: text/html; charset=iso-8859-1',
      '',
      '<div>R\xe9sum\xe9</div><div>two</div>',
    ].join('\n');
    const mail = readInboundMail(
      Uint8Array.from(latin1, (c) => c.charCodeAt(0)),
      opts,
    );
    expect(mail.text).toBe('Résumé\ntwo');
    expect(mail.authentication.reason).toBe('no_results');
  });

  it('answers empty for a message it cannot read', () => {
    const mail = readInboundMail(new Uint8Array([0, 1, 2]), opts);
    expect(mail.from).toBeNull();
    expect(mail.subject).toBe('');
    expect(mail.text).toBe('');
    const none = read(['Content-Type: image/png', '', 'x']);
    expect(none.text).toBe('');
  });

  it('reads a 1 MB worst-case body inside its budget', () => {
    const body = ['=', '>', ' ', 'On x wrote'].map((s) => s.repeat(250_000 / s.length)).join('\n');
    const raw = enc.encode(
      ['Content-Type: text/plain', 'Content-Transfer-Encoding: quoted-printable', '', body].join(
        '\r\n',
      ),
    );
    expect(cpuMsOf(() => readInboundMail(raw, opts))).toBeLessThan(cpuBudgetMs(150));
  });
});
