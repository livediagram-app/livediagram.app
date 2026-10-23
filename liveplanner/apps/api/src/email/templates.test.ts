import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import {
  accountDeletedEmail,
  activationEmail,
  winBackEmail,
  week1Email,
  week2Email,
  welcomeEmail,
} from './templates';

const env = { APP_BASE_URL: 'https://app.test' } as unknown as Env;

describe('email templates', () => {
  // docs/specs/014-identity/transactional-email.md §6 "Branding": every email opens with the logo mark next
  // to the wordmark and closes on the branded footer, all from the one shell.
  it.each([
    ['welcome', () => welcomeEmail(env)],
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

  it('account-deleted confirms the deletion', () =>
    expect(accountDeletedEmail(env).subject).toMatch(/deleted/i));

});

