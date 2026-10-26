import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import {
  accountDeletedEmail,
  commentNotificationEmail,
  designJoinedEmail,
  mentionedEmail,
  milestoneEmail,
  mentionQuote,
  MENTION_QUOTE_CHARS,
} from './templates';

const env = { APP_BASE_URL: 'https://app.test' } as unknown as Env;

describe('email templates', () => {
  // docs/specs/014-identity/transactional-email.md §6 "Branding": every email opens with the logo mark next
  // to the wordmark and closes on the branded footer, all from the one shell.
  it.each([
    ['milestone', () => milestoneEmail(env, 10)],
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

  // The opt-out emails link to the toggle that stops them, in their footer and their List-Unsubscribe
  // header. The onboarding series is liveworkspace's own (liveworkspace/docs/specs/003-accounts/accounts.md).
  it.each([
    ['milestone', () => milestoneEmail(env, 10)],
    ['comment', () => commentNotificationEmail(env, 'Roadmap', 'd1', 'Anna')],
  ])('%s carries the manage-notifications footer and unsubscribe url', (_label, build) => {
    const e = build();
    expect(e.unsubscribeUrl).toBe('https://app.test/explorer?settings=notifications');
    expect(e.html).toContain('Manage your notifications');
  });

  it('account-deleted confirms the deletion', () =>
    expect(accountDeletedEmail(env).subject).toMatch(/deleted/i));

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
