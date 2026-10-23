import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import {
  accountDeletedEmail,
  activationEmail,
  winBackEmail,
  designJoinedEmail,
  inviteResponseEmail,
  teamInviteEmail,
  teamInviteReminderEmail,
  week1Email,
  week2Email,
  welcomeEmail,
  mentionedEmail,
  mentionQuote,
  MENTION_QUOTE_CHARS,
} from './templates';

const env = { APP_BASE_URL: 'https://app.test' } as unknown as Env;

describe('email templates', () => {
  // docs/specs/014-identity/transactional-email.md §6 "Branding": every email opens with the logo mark next
  // to the wordmark and closes on the branded footer, all from the one shell.
  it.each([
    ['welcome', () => welcomeEmail(env)],
    ['team invite', () => teamInviteEmail(env, 'Acme')],
    ['account deleted', () => accountDeletedEmail(env)],
  ])('%s carries the logo beside the wordmark', (_label, build) => {
    const { html } = build();
    expect(html).toContain('<img src="https://app.test/email/livedesign-mark-64.png"');
    const logo = html.indexOf('email/livedesign-mark-64.png');
    const wordmark = html.indexOf('>live</span>design');
    expect(logo).toBeGreaterThan(-1);
    expect(wordmark).toBeGreaterThan(logo);
    // Header and footer both carry the lockup, each linked home.
    expect(html.match(/livedesign-mark-64\.png/g)).toHaveLength(2);
    expect(html).toContain('<a href="https://app.test" style="text-decoration:none">');
    expect(html).toContain('>app.test</a>');
  });

  it('welcome has a subject + links to /new', () => {
    const e = welcomeEmail(env);
    expect(e.subject).toMatch(/welcome/i);
    expect(e.html).toContain('https://app.test/new');
  });

  it('week 1 links to the explorer', () =>
    expect(week1Email(env).html).toContain('https://app.test/explorer'));

  it('week 2 links to teams', () =>
    expect(week2Email(env).html).toContain('https://app.test/explorer/team'));

  // docs/specs/014-identity/transactional-email.md: every tip / check-in respects notifyTips, so each one
  // links to the toggle in its footer and in its List-Unsubscribe header.
  it.each([
    ['week 1', week1Email],
    ['week 2', week2Email],
    ['activation', activationEmail],
    ['win-back', winBackEmail],
  ])('%s carries the manage-notifications footer and unsubscribe url', (_label, build) => {
    const e = build(env);
    expect(e.unsubscribeUrl).toBe('https://app.test/explorer?settings=notifications');
    expect(e.html).toContain('Manage your notifications');
    expect(e.html).toContain('tips and check-ins are on');
  });

  it('the welcome is not opt-out, so it carries no unsubscribe url', () =>
    expect(welcomeEmail(env).unsubscribeUrl).toBeUndefined());

  it('team invite links to the invites page + names the team', () => {
    const e = teamInviteEmail(env, 'Acme');
    expect(e.html).toContain('https://app.test/explorer/invites');
    expect(e.html).toContain('Acme');
    expect(e.subject).toContain('Acme');
  });

  it('account-deleted confirms the deletion', () =>
    expect(accountDeletedEmail(env).subject).toMatch(/deleted/i));

  it('escapes a malicious team name (no raw markup in the body)', () => {
    const e = teamInviteEmail(env, '<script>alert(1)</script>');
    expect(e.html).not.toContain('<script>');
    expect(e.html).toContain('&lt;script&gt;');
  });

  it('falls back gracefully on a null team name', () =>
    expect(teamInviteEmail(env, null).html).toContain('a team'));

  // docs/specs/013-workspace/teams.md "Declining from the email"
  it('team invite carries a Decline link to /join/decline with its token, escaped for the URL', () => {
    const e = teamInviteEmail(env, 'Acme', 'm-1.a/b+c');
    expect(e.html).toContain('https://app.test/join/decline?token=m-1.a%2Fb%2Bc');
    expect(e.html).toContain('Decline the invite');
    expect(e.html).toContain('no account needed');
  });

  it('team invite without a token has no Decline link', () =>
    expect(teamInviteEmail(env, 'Acme').html).not.toContain('/join/decline'));

  // docs/specs/013-workspace/teams.md "Reminders and expiry"
  it('the three reminders name the team, link to the invites page and carry the decline link', () => {
    const subjects = new Set<string>();
    for (const stage of [1, 2, 3] as const) {
      const e = teamInviteReminderEmail(env, 'Acme', stage, 'tok');
      expect(e.kind).toBe(`TeamInviteReminder${stage}`);
      expect(e.subject).toContain('Acme');
      expect(e.html).toContain('https://app.test/explorer/invites');
      expect(e.html).toContain('https://app.test/join/decline?token=tok');
      expect(e.unsubscribeUrl).toBeUndefined();
      subjects.add(e.subject);
    }
    expect(subjects.size).toBe(3);
    expect(teamInviteReminderEmail(env, 'Acme', 3, 'tok').html).toMatch(/closes in a week/);
  });

  it('reminders escape the team name too', () => {
    const e = teamInviteReminderEmail(env, '<b>x</b>\nBcc: y', 2, 'tok');
    expect(e.html).not.toContain('<b>x</b>');
    expect(e.subject).not.toContain('\n');
  });

  // docs/specs/014-identity/profile-and-email-notifications.md — someone joined my design
  it('design-joined names the design + joiner and CTAs to the explorer', () => {
    const e = designJoinedEmail(env, 'Roadmap', 'Anna');
    expect(e.subject).toMatch(/Anna/);
    expect(e.html).toContain('Roadmap');
    expect(e.html).toContain('Anna');
    expect(e.html).toContain('https://app.test/explorer');
  });

  it('design-joined says join notifications are on by default, not that the owner turned them on', () => {
    const e = designJoinedEmail(env, 'Roadmap', 'Anna');
    expect(e.html).not.toContain('you turned on');
    expect(e.html).toContain('on by default');
  });

  it('design-joined falls back to "Someone" / "your design" when unknown', () => {
    const e = designJoinedEmail(env, '', null);
    expect(e.subject).toMatch(/Someone/);
    expect(e.html).toContain('your design');
  });

  it('design-joined escapes a malicious design name', () => {
    const e = designJoinedEmail(env, '<img src=x onerror=1>', null);
    expect(e.html).not.toContain('<img src=x');
    expect(e.html).toContain('&lt;img');
  });

  // docs/specs/014-identity/profile-and-email-notifications.md — someone responded to a team invite
  it('invite-response distinguishes accept from decline', () => {
    const yes = inviteResponseEmail(env, 'Acme', 'a@b.test', true);
    expect(yes.subject).toMatch(/accepted/i);
    expect(yes.html).toContain('a@b.test');
    expect(yes.html).toContain('Acme');
    const no = inviteResponseEmail(env, 'Acme', 'a@b.test', false);
    expect(no.subject).toMatch(/declined/i);
  });

  it('invite-response escapes a malicious team name', () => {
    const e = inviteResponseEmail(env, '<b>x</b>', 'a@b.test', true);
    expect(e.html).not.toContain('<b>x</b>');
    expect(e.html).toContain('&lt;b&gt;');
  });
});

describe('mentionedEmail (docs/specs/012-collaboration/comment-mentions.md)', () => {
  it('quotes the comment escaped, and cuts a long one at a word', () => {
    const e = mentionedEmail(env, 'Sam <b>', 'Roadmap', 'd1', 'look <here> please');
    expect(e.kind).toBe('Mentioned');
    expect(e.html).toContain('look &lt;here&gt; please');
    expect(e.html).toContain('Sam &lt;b&gt;');
    const long = `${'word '.repeat(100)}end`;
    const quoted = mentionQuote(long);
    expect(quoted.length).toBeLessThanOrEqual(MENTION_QUOTE_CHARS + 1);
    expect(quoted.endsWith('word…')).toBe(true);
  });

  it('opens the design', () => {
    expect(mentionedEmail(env, 'Sam', 'Roadmap', 'd1', 'hi').html).toContain('Open the design');
  });

  it('falls back to "A teammate" without an author name', () => {
    expect(mentionedEmail(env, null, 'Roadmap', 'd1', 'hi').subject).toBe(
      'A teammate mentioned you in Roadmap',
    );
  });
});
