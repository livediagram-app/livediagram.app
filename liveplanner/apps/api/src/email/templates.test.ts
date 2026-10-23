import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import { accountDeletedEmail, commentNotificationEmail, formResponseEmail } from './templates';

const env = { APP_BASE_URL: 'https://app.test' } as unknown as Env;

describe('email templates', () => {
  // docs/specs/014-identity/transactional-email.md §6 "Branding": every email opens with the logo mark next
  // to the wordmark and closes on the branded footer, all from the one shell.
  it.each([
    ['comment notification', () => commentNotificationEmail(env, 'Roadmap', 'p1', 'Ada')],
    ['account deleted', () => accountDeletedEmail(env)],
  ])('%s carries the logo beside the wordmark', (_label, build) => {
    const { html } = build();
    expect(html).toContain('<img src="https://app.test/email/liveplanner-mark-64.png"');
    const logo = html.indexOf('email/liveplanner-mark-64.png');
    const wordmark = html.indexOf('>live</span>planner');
    expect(logo).toBeGreaterThan(-1);
    expect(wordmark).toBeGreaterThan(logo);
    // Header and footer both carry the lockup, each linked home.
    expect(html.match(/liveplanner-mark-64\.png/g)).toHaveLength(2);
    expect(html).toContain('<a href="https://app.test" style="text-decoration:none">');
    expect(html).toContain('>app.test</a>');
  });

  // docs/specs/014-identity/transactional-email.md: every opt-out notification links to the switch that stops
  // it, in its footer and in its List-Unsubscribe header.
  it.each([
    ['comment notification', () => commentNotificationEmail(env, 'Roadmap', 'p1', 'Ada')],
    [
      'form response',
      () => formResponseEmail(env, { heading: 'Intake', projectId: 'p1', projectName: 'Roadmap' }, 'A card', 0),
    ],
  ])('%s carries the manage-notifications footer and unsubscribe url', (_label, build) => {
    const e = build();
    expect(e.unsubscribeUrl).toBe('https://app.test/explorer?settings=notifications');
    expect(e.html).toContain('Manage your notifications');
  });

  it('account-deleted confirms the deletion, and is not opt-out', () => {
    const e = accountDeletedEmail(env);
    expect(e.subject).toMatch(/deleted/i);
    expect(e.unsubscribeUrl).toBeUndefined();
  });
});
