import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { authResults, authenticationOf } from './authentication';
import { htmlToText, tidyLines } from './html-text';
import { stripQuotedReply } from './quoted';
import { addressOf, decodeEncodedWords } from './words';

describe('decodeEncodedWords', () => {
  it('decodes B and Q words and drops the space between two of them', () => {
    expect(decodeEncodedWords('=?UTF-8?B?Q2Fmw6k=?= =?utf-8?q?_menu=21?= today')).toBe(
      'Café menu! today',
    );
    expect(decodeEncodedWords('Re: =?ISO-8859-1?Q?=E9t=E9?=')).toBe('Re: été');
    expect(decodeEncodedWords('=?utf-8*en?Q?hi?=')).toBe('hi');
  });

  it('leaves text that only looks like a word', () => {
    expect(decodeEncodedWords('a =? b')).toBe('a =? b');
    expect(decodeEncodedWords('=?utf-8?X?abc?=')).toBe('=?utf-8?X?abc?=');
    expect(decodeEncodedWords('=?utf-8?Q?open')).toBe('=?utf-8?Q?open');
    expect(decodeEncodedWords('=?utf-8')).toBe('=?utf-8');
    expect(decodeEncodedWords('=?utf-8?B?####?=')).toBe('');
    expect(decodeEncodedWords('=?utf-8?B?A?=')).toBe('=?utf-8?B?A?=');
  });
});

describe('addressOf', () => {
  it('reads the bare address, lower-cased', () => {
    expect(addressOf('Ada <Ada@Example.COM>')).toBe('ada@example.com');
    expect(addressOf(' b@example.com ')).toBe('b@example.com');
  });

  it('answers null for no address', () => {
    for (const v of [undefined, '', 'nobody', '@x', 'a@', 'a@b@c', 'a b@c', 'a@b,c', 'a\x7f@b'])
      expect(addressOf(v)).toBeNull();
  });
});

describe('htmlToText', () => {
  it('drops tags, breaks blocks and decodes entities', () => {
    const html =
      '<html><head><title>T</title><style>p{}</style></head><body><p>Hi&nbsp;there &amp; you</p>' +
      '<div>Line&#33; &#x41;<br/>next &bogus; &</div><script>alert(1)</script><SCRIPT/>end</body></html>';
    expect(htmlToText(html)).toBe('Hi there & you\nLine! A\nnext &bogus; &\nend');
  });

  it('stops at an unclosed tag or skipped block', () => {
    expect(htmlToText('text <b')).toBe('text');
    expect(htmlToText('a<style>never closed')).toBe('a');
    expect(htmlToText('a<style>x</style')).toBe('a');
    expect(htmlToText('&#0; &#xZZ; &copy;')).toBe('&#0; &#xZZ; ©');
  });

  it('collapses spaces and empty lines', () => {
    expect(tidyLines('\n\n a   b \n\n\n c\n\n')).toBe('a b\n\nc');
  });

  it('stays linear on hostile input', () => {
    const amps = '&'.repeat(200_000);
    const tags = '<'.repeat(100_000) + '>';
    expect(cpuMsOf(() => htmlToText(amps))).toBeLessThan(cpuBudgetMs(50));
    expect(cpuMsOf(() => htmlToText(tags))).toBeLessThan(cpuBudgetMs(50));
  });
});

const trusted = ['mx.cloudflare.net'];

describe('authenticationOf', () => {
  const of = (header: string | undefined, from = 'a@x.com', envelopeFrom = 'a@x.com') =>
    authenticationOf(header, { trusted, from, envelopeFrom });

  it('passes on dmarc=pass from a trusted server', () => {
    expect(of('mx.cloudflare.net; dkim=pass header.d=x.com; spf=pass; dmarc=pass')).toEqual({
      verdict: 'pass',
      reason: 'dmarc_pass',
    });
  });

  it('fails with no header or an untrusted server', () => {
    expect(of(undefined).reason).toBe('no_results');
    expect(of('evil.example; dmarc=pass').reason).toBe('no_results');
  });

  it('fails a failing DMARC whatever else passed', () => {
    expect(of('mx.cloudflare.net; spf=pass; dkim=pass; dmarc=fail').reason).toBe('dmarc_fail');
  });

  it('passes an aligned SPF or DKIM pass when there is no DMARC verdict', () => {
    expect(of('mx.cloudflare.net 1; spf=pass (ok); dmarc=none').reason).toBe('aligned_pass');
    expect(
      of('mx.cloudflare.net; dkim=fail; dkim=pass header.d=X.com', 'a@x.com', 'A@X.com ').verdict,
    ).toBe('pass');
    expect(of('mx.cloudflare.net; spf=pass', 'a@x.com', 'b@x.com').reason).toBe('unaligned');
    expect(
      authenticationOf('mx.cloudflare.net; spf=pass', {
        trusted,
        from: null,
        envelopeFrom: 'a@x.com',
      }).reason,
    ).toBe('unaligned');
    expect(of('mx.cloudflare.net; spf=softfail; dkim=none; junk; =x').reason).toBe('none_passed');
  });

  // A DKIM pass proves the domain that signed, not the From: anyone can sign a forged From with a domain of their
  // own, and a domain with no DMARC policy gives no verdict to stop it.
  it("counts a DKIM pass only when the signing domain is the sender's", () => {
    const dkim = (rest: string, from = 'a@x.com') =>
      of(`mx.cloudflare.net; dkim=pass ${rest}; spf=fail; dmarc=none`, from, from);
    expect(dkim('header.d=attacker.example header.s=s1 header.b=abc').reason).toBe('unaligned');
    expect(dkim('header.d=evilx.com').reason).toBe('unaligned');
    expect(dkim('header.d=mail.x.com').reason).toBe('unaligned');
    expect(dkim('').reason).toBe('unaligned');
    expect(dkim('header.d=').reason).toBe('unaligned');
    expect(dkim('header.i=@attacker.example').reason).toBe('unaligned');
    // The sender's own domain, or its parent; by `header.i` when there is no `header.d`; any one of several.
    expect(dkim('(ok)  header.d=x.com header.s=s1').reason).toBe('aligned_pass');
    expect(dkim('header.d=x.com', 'a@mail.x.com').reason).toBe('aligned_pass');
    expect(dkim('header.i=bob@X.com').reason).toBe('aligned_pass');
    expect(dkim('header.d=attacker.example; dkim=pass header.d=x.com').reason).toBe('aligned_pass');
    // An SPF pass still proves the envelope's domain, which is the From's.
    expect(of('mx.cloudflare.net; dkim=pass header.d=attacker.example; spf=pass').reason).toBe(
      'aligned_pass',
    );
    // A passing DMARC is the receiver's own alignment check.
    expect(of('mx.cloudflare.net; dkim=pass header.d=other.example; dmarc=pass').verdict).toBe(
      'pass',
    );
  });

  it('reads the signing domains of the passing signatures only', () => {
    const header =
      'mx.cloudflare.net; dkim=fail header.d=a.com; dkim=pass header.d=B.com; dkim=pass';
    expect(authResults(header).dkimDomains).toEqual(['b.com']);
  });

  it('reads the first result of each method', () => {
    expect(authResults('MX.Cloudflare.net; spf=fail; spf=pass').results.get('spf')).toBe('fail');
    expect(authResults('').servId).toBe('');
  });
});

describe('stripQuotedReply', () => {
  it('cuts at a quote opener', () => {
    expect(stripQuotedReply('Please fix.\n\nOn Mon, 3 Mar, Bo <b@x.com> wrote:\n> old')).toBe(
      'Please fix.',
    );
    expect(stripQuotedReply('Fix\nOn Mon, 3 Mar 2027 at 10:00, Bo\n<b@x.com> wrote:\n> old')).toBe(
      'Fix',
    );
    expect(stripQuotedReply('Fix\nLe lun. 3 mars, Bo a écrit :\n> old')).toBe('Fix');
    expect(stripQuotedReply('Fix\r\n-----Original Message-----\r\nFrom: b')).toBe('Fix');
    expect(stripQuotedReply('Fix\n\nFrom: Bo\nSent: today')).toBe('Fix');
    expect(stripQuotedReply('Fix\n' + '_'.repeat(32) + '\nFrom: Bo')).toBe('Fix');
  });

  it('keeps a From: line that is not under a blank one', () => {
    expect(stripQuotedReply('From: me\nhello')).toBe('From: me\nhello');
  });

  it('cuts a trailing > run and a signature', () => {
    expect(stripQuotedReply('Yes.\n\n> earlier\n>\n> more\n')).toBe('Yes.');
    expect(stripQuotedReply('> quoted\nMy answer')).toBe('> quoted\nMy answer');
    expect(stripQuotedReply('Thanks\n-- \nBo\nCEO')).toBe('Thanks');
    expect(stripQuotedReply('Thanks\n\n')).toBe('Thanks');
  });

  it('keeps an all-quote message whole', () => {
    expect(stripQuotedReply('On Mon, Bo wrote:\n> the forward')).toBe(
      'On Mon, Bo wrote:\n> the forward',
    );
    expect(stripQuotedReply('> only\n> quote')).toBe('> only\n> quote');
  });

  it('stays linear on hostile input', () => {
    const openers = 'On x wrote\n'.repeat(60_000);
    const quotes = '>\n'.repeat(64_000) + 'end';
    const spaces = ' '.repeat(100_000);
    expect(cpuMsOf(() => stripQuotedReply(openers))).toBeLessThan(cpuBudgetMs(50));
    expect(cpuMsOf(() => stripQuotedReply(quotes))).toBeLessThan(cpuBudgetMs(50));
    expect(cpuMsOf(() => stripQuotedReply(spaces))).toBeLessThan(cpuBudgetMs(50));
  });
});
