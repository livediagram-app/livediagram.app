import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  codeEmail,
  inviteResponseEmail,
  sendCodeEmail,
  teamInviteEmail,
  tokenExpiringEmail,
} from './email.ts';
import { emailBrand, escapeHtml, list } from './email-layout.ts';
import type { Env } from './env.ts';

const env = (over: Partial<Env>) =>
  ({
    ENVIRONMENT: 'production',
    BASE_URL: 'https://liveworkspace.test',
    EMAIL_FROM: 'sign-in@liveworkspace.app',
    ...over,
  }) as Env;

afterEach(() => vi.unstubAllGlobals());

describe('codeEmail', () => {
  it('wears liveworkspace’s brand on its own sign-in page', () => {
    const email = codeEmail('123456', emailBrand(env({}), null));

    expect(email.subject).toBe('123456 is your liveworkspace sign-in code');
    expect(email.html).toContain(
      '<img src="https://liveworkspace.test/email/liveworkspace-mark-64.png"',
    );
    expect(email.html).toContain('>live</span>workspace<');
    expect(email.html).toContain('>123456</span>');
    expect(email.text).toContain('Your liveworkspace sign-in code is 123456');
  });

  it('wears the app’s logo and colours when sent through its address', () => {
    const email = codeEmail('123456', emailBrand(env({}), 'liveplanner.app'));

    expect(email.subject).toBe('123456 is your liveplanner sign-in code');
    expect(email.html).toContain(
      '<img src="https://www.liveplanner.app/email/liveplanner-mark-64.png"',
    );
    expect(email.html).toContain('>live</span>planner<');
    // Its brand-50 behind the card, and its prism in the band.
    expect(email.html).toContain('background:#f5f3ff');
    expect(email.html).toContain('linear-gradient(90deg,');
  });

  it('links staging’s app in staging', () => {
    const email = codeEmail(
      '123456',
      emailBrand(env({ ENVIRONMENT: 'staging' }), 'livedesign.app'),
    );
    expect(email.html).toContain('https://staging.livedesign.app/email/livedesign-mark-64.png');
  });
});

describe('sendCodeEmail', () => {
  const binding = (send: () => Promise<{ messageId: string }>) => ({ send: vi.fn(send) });

  it('sends through the EMAIL binding, from liveworkspace', async () => {
    const EMAIL = binding(async () => ({ messageId: 'm' }));
    await sendCodeEmail(env({ EMAIL: EMAIL as unknown as SendEmail }), 'ada@example.com', '123456');

    expect(EMAIL.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { email: 'sign-in@liveworkspace.app', name: 'liveworkspace' },
        to: 'ada@example.com',
        subject: '123456 is your liveworkspace sign-in code',
      }),
    );
  });

  it('fails when Email Service refuses, so the page can say the code was not sent', async () => {
    const EMAIL = binding(async () => {
      throw Object.assign(new Error('domain not onboarded'), { code: 'E_SENDER_NOT_VERIFIED' });
    });
    await expect(
      sendCodeEmail(env({ EMAIL: EMAIL as unknown as SendEmail }), 'ada@example.com', '123456'),
    ).rejects.toThrow('domain not onboarded');
  });

  it('logs the email in development without the binding', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await sendCodeEmail(env({ ENVIRONMENT: 'development' }), 'ada@example.com', '123456');

    expect(log).toHaveBeenCalledWith(
      '[email] To: ada@example.com Subject: 123456 is your liveworkspace sign-in code',
    );
    log.mockRestore();
  });

  it('refuses outside development without the binding, rather than dropping the email', async () => {
    await expect(sendCodeEmail(env({}), 'ada@example.com', '123456')).rejects.toThrow(
      'the EMAIL binding is not set',
    );
  });
});

describe('inviteResponseEmail', () => {
  it('links to the account’s settings, where admins turn these off', () => {
    const email = inviteResponseEmail('https://liveworkspace.app/', 'Design', 'Ada', true);
    expect(email.unsubscribeUrl).toBe('https://liveworkspace.app/explorer?settings=notifications');
    expect(email.html).toContain(
      'href="https://liveworkspace.app/explorer?settings=notifications"',
    );
    expect(email.text).toContain('https://liveworkspace.app/explorer?settings=notifications');
  });

  it("opens the team's view in the Explorer", () => {
    const email = inviteResponseEmail(
      'https://liveworkspace.app/',
      'Design',
      'Ada',
      true,
      'team_1',
    );
    expect(email.html).toContain('href="https://liveworkspace.app/explorer/team?id=team_1"');
  });
});

// What liveworkspace's frame always draws: its slate canvas, the prism band, and the mark beside the wordmark.
function expectWorkspaceFrame(html: string) {
  expect(html).toContain('background:#f1f5f9');
  expect(html).toContain('linear-gradient(90deg,');
  expect(html).toContain('<img src="https://liveworkspace.app/email/liveworkspace-mark-64.png"');
  expect(html).toContain('>live</span>workspace<');
}

describe('teamInviteEmail', () => {
  const base = 'https://liveworkspace.app/';

  it('is drawn in liveworkspace’s frame, with a heading, a button and its sign-off', () => {
    const email = teamInviteEmail(base, 'Design', 'Ada', 'tok_1');
    expectWorkspaceFrame(email.html);
    expect(email.html).toContain('>You’re invited to Design</h1>');
    expect(email.html).toContain(
      'href="https://liveworkspace.app/explorer/invites" style="display:inline-block',
    );
    expect(email.html).toContain('href="https://liveworkspace.app/join/decline?token=tok_1"');
    expect(email.html).toContain('An invitation nobody answers closes after 28 days.</p>');
  });

  it('keeps its plain-text part, every link written out', () => {
    const email = teamInviteEmail(base, 'Design', 'Ada', 'tok_1');
    expect(email.subject).toBe('Ada invited you to Design on liveworkspace');
    expect(email.text).toContain('Ada invited you to join the team Design on liveworkspace.');
    expect(email.text).toContain('https://liveworkspace.app/explorer/invites');
    expect(email.text).toContain('https://liveworkspace.app/join/decline?token=tok_1');
  });

  it('escapes the team’s and the inviter’s names everywhere in the HTML', () => {
    const email = teamInviteEmail(base, '<b>Ops</b>', 'Eve "x" & co', 'a&b');
    expect(email.html).not.toContain('<b>Ops</b>');
    expect(email.html).toContain('You’re invited to &#60;b&#62;Ops&#60;/b&#62;</h1>');
    expect(email.html).toContain('Eve &#34;x&#34; &#38; co invited you');
    expect(email.html).toContain('href="https://liveworkspace.app/join/decline?token=a%26b"');
  });

  it('names a reminder in its heading and subject, and falls back to Someone', () => {
    const email = teamInviteEmail(base, 'Design', '  ', 'tok_1', 2);
    expect(email.subject).toBe('Reminder: Someone invited you to Design on liveworkspace');
    expect(email.html).toContain('>A reminder about Design</h1>');
    expect(email.text).toContain('A reminder: Someone invited you');
  });
});

describe('inviteResponseEmail in the frame', () => {
  it('heads an acceptance and a refusal, and escapes both names', () => {
    const accepted = inviteResponseEmail('https://liveworkspace.app', '<Ops>', 'Bo & Co', true);
    expectWorkspaceFrame(accepted.html);
    expect(accepted.html).toContain('>Invitation accepted</h1>');
    expect(accepted.html).toContain('<strong>Bo &#38; Co</strong> accepted');
    expect(accepted.html).toContain('<strong>&#60;Ops&#62;</strong>');
    expect(accepted.html).not.toContain('<Ops>');
    expect(accepted.text).toContain(
      'Bo & Co accepted the invitation to join <Ops> on liveworkspace.',
    );

    const declined = inviteResponseEmail('https://liveworkspace.app', 'Ops', 'Bo', false);
    expect(declined.html).toContain('>Invitation declined</h1>');
    expect(declined.subject).toBe('Bo declined your invitation to Ops');
  });
});

describe('tokenExpiringEmail in the frame', () => {
  it('numbers its steps under a heading, with its button and sign-off', () => {
    const email = tokenExpiringEmail('https://liveworkspace.app', 'CI', Date.UTC(2026, 0, 5));
    expectWorkspaceFrame(email.html);
    expect(email.html).toContain('>Your API token expires soon</h1>');
    expect(email.html).toContain('<ol style=');
    expect(email.html).toContain('Revoke the old token once the switch is done.</li>');
    expect(email.html).toContain('nearing its expiry.</p>');
    expect(email.text).toContain('- Revoke the old token once the switch is done.');
  });
});

describe('the frame’s pieces', () => {
  it('draws a bulleted list by default and a numbered one when asked', () => {
    expect(list(['a'])).toMatch(/^<ul style="[^"]+"><li style="[^"]+">a<\/li><\/ul>$/);
    expect(list(['a', 'b'], true)).toMatch(/^<ol .*>b<\/li><\/ol>$/);
  });

  it('escapes every character that could break out of text or an attribute', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&#60;a href=&#34;x&#34;&#62;&#39;&#38;&#39;&#60;/a&#62;',
    );
  });
});
