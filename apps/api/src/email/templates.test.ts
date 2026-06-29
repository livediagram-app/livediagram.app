import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import {
  accountDeletedEmail,
  diagramJoinedEmail,
  inviteResponseEmail,
  teamInviteEmail,
  week1Email,
  week2Email,
  welcomeEmail,
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

  // spec/65 — someone joined my diagram
  it('diagram-joined names the diagram + joiner and CTAs to the explorer', () => {
    const e = diagramJoinedEmail(env, 'Roadmap', 'Anna');
    expect(e.subject).toMatch(/Anna/);
    expect(e.html).toContain('Roadmap');
    expect(e.html).toContain('Anna');
    expect(e.html).toContain('https://app.test/explorer');
  });

  it('diagram-joined falls back to "Someone" / "your diagram" when unknown', () => {
    const e = diagramJoinedEmail(env, '', null);
    expect(e.subject).toMatch(/Someone/);
    expect(e.html).toContain('your diagram');
  });

  it('diagram-joined escapes a malicious diagram name', () => {
    const e = diagramJoinedEmail(env, '<img src=x onerror=1>', null);
    expect(e.html).not.toContain('<img src=x');
    expect(e.html).toContain('&lt;img');
  });

  // spec/65 — someone responded to a team invite
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
