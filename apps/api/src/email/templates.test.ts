import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import {
  accountDeletedEmail,
  activationEmail,
  winBackEmail,
  documentJoinedEmail,
  inviteResponseEmail,
  teamInviteEmail,
  week1Email,
  week2Email,
  welcomeEmail,
  mentionedEmail,
  mentionQuote,
  MENTION_QUOTE_CHARS,
} from './templates';

const env = { APP_BASE_URL: 'https://app.test' } as unknown as Env;

describe('email templates', () => {
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

  // docs/specs/014-identity/profile-and-email-notifications.md — someone joined my document
  it('document-joined names the document + joiner and CTAs to the explorer', () => {
    const e = documentJoinedEmail(env, 'Roadmap', 'Anna');
    expect(e.subject).toMatch(/Anna/);
    expect(e.html).toContain('Roadmap');
    expect(e.html).toContain('Anna');
    expect(e.html).toContain('https://app.test/explorer');
  });

  it('document-joined falls back to "Someone" / "your document" when unknown', () => {
    const e = documentJoinedEmail(env, '', null);
    expect(e.subject).toMatch(/Someone/);
    expect(e.html).toContain('your document');
  });

  it('document-joined escapes a malicious document name', () => {
    const e = documentJoinedEmail(env, '<img src=x onerror=1>', null);
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

  it("opens the card for a card's comment, the document otherwise", () => {
    const card = mentionedEmail(env, 'Sam', 'Roadmap', 'd1', 'hi', 'it 1');
    expect(card.html).toContain('/document/d1#item=it%201');
    expect(card.html).toContain('Open the card');
    const doc = mentionedEmail(env, 'Sam', 'Roadmap', 'd1', 'hi');
    expect(doc.html).not.toContain('#item=');
    expect(doc.html).toContain('Open the document');
  });

  it('falls back to "A teammate" without an author name', () => {
    expect(mentionedEmail(env, null, 'Roadmap', 'd1', 'hi').subject).toBe(
      'A teammate mentioned you in Roadmap',
    );
  });
});
