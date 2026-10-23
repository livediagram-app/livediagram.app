import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import {
  accountDeletedEmail,
  milestoneEmail,
  documentJoinedEmail,
  mentionedEmail,
  mentionQuote,
  MENTION_QUOTE_CHARS,
} from './templates';

const env = { APP_BASE_URL: 'https://app.test' } as unknown as Env;

describe('email templates', () => {
  // docs/specs/014-identity/transactional-email.md §6 "Branding": every email opens with the logo mark next
  // to the wordmark and closes on the branded footer, all from the one shell.
  it.each([
    ['milestone', () => milestoneEmail(env, 10)],
    ['document joined', () => documentJoinedEmail(env, 'Plan', 'Ann')],
    ['account deleted', () => accountDeletedEmail(env)],
  ])('%s carries the logo beside the wordmark', (_label, build) => {
    const { html } = build();
    expect(html).toContain('<img src="https://app.test/email/livediagram-mark-64.png"');
    const logo = html.indexOf('email/livediagram-mark-64.png');
    const wordmark = html.indexOf('>live</span>diagram');
    expect(logo).toBeGreaterThan(-1);
    expect(wordmark).toBeGreaterThan(logo);
    // Header and footer both carry the lockup, each linked home.
    expect(html.match(/livediagram-mark-64\.png/g)).toHaveLength(2);
    expect(html).toContain('<a href="https://app.test" style="text-decoration:none">');
    expect(html).toContain('>app.test</a>');
  });

  it('account-deleted confirms the deletion', () =>
    expect(accountDeletedEmail(env).subject).toMatch(/deleted/i));

  it('document-joined names the document + joiner and CTAs to the explorer', () => {
    const e = documentJoinedEmail(env, 'Roadmap', 'Anna');
    expect(e.subject).toMatch(/Anna/);
    expect(e.html).toContain('Roadmap');
    expect(e.html).toContain('Anna');
    expect(e.html).toContain('https://app.test/explorer');
  });

  it('document-joined says join notifications are on by default, not that the owner turned them on', () => {
    const e = documentJoinedEmail(env, 'Roadmap', 'Anna');
    expect(e.html).not.toContain('you turned on');
    expect(e.html).toContain('on by default');
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

  it('opens the document', () => {
    const doc = mentionedEmail(env, 'Sam', 'Roadmap', 'd1', 'hi');
    expect(doc.html).toContain('/document/d1');
    expect(doc.html).toContain('Open the document');
  });

  it('falls back to "A teammate" without an author name', () => {
    expect(mentionedEmail(env, null, 'Roadmap', 'd1', 'hi').subject).toBe(
      'A teammate mentioned you in Roadmap',
    );
  });
});
