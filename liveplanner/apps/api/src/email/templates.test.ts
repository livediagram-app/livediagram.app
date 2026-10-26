import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import {
  accountDeletedEmail,
  actionAssignedEmail,
  commentNotificationEmail,
  firstShareEmail,
  formResponseEmail,
  MENTION_QUOTE_CHARS,
  mentionedEmail,
  mentionQuote,
  milestoneEmail,
  projectJoinedEmail,
} from './templates';

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
      () =>
        formResponseEmail(
          env,
          { heading: 'Intake', projectId: 'p1', projectName: 'Roadmap' },
          'A card',
          0,
        ),
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

// docs/specs/014-identity/profile-and-email-notifications.md: someone joined my plan.
describe('projectJoinedEmail', () => {
  it('names the plan + joiner and CTAs to the explorer', () => {
    const e = projectJoinedEmail(env, 'Roadmap', 'Anna');
    expect(e.kind).toBe('ProjectJoined');
    expect(e.subject).toMatch(/Anna/);
    expect(e.html).toContain('Roadmap');
    expect(e.html).toContain('https://app.test/explorer');
  });

  it('says join notifications are on by default, not that the owner turned them on', () => {
    const e = projectJoinedEmail(env, 'Roadmap', 'Anna');
    expect(e.html).not.toContain('you turned on');
    expect(e.html).toContain('on by default');
  });

  it('falls back to "Someone" / "your plan" when unknown, and escapes the name', () => {
    const e = projectJoinedEmail(env, '', null);
    expect(e.subject).toMatch(/Someone/);
    expect(e.html).toContain('your plan');
    const bad = projectJoinedEmail(env, '<img src=x onerror=1>', null);
    expect(bad.html).not.toContain('<img src=x');
    expect(bad.html).toContain('&lt;img');
  });
});

describe('actionAssignedEmail (docs/specs/012-collaboration/assigned-actions.md)', () => {
  it('names the assigner, plan, and action, links to the plan', () => {
    const e = actionAssignedEmail(
      env,
      'Sam',
      { id: 'd1', name: 'Roadmap' },
      'Review the copy',
      'Hero only',
    );
    expect(e.kind).toBe('ActionAssigned');
    expect(e.subject).toMatch(/Sam/);
    expect(e.html).toContain('Roadmap');
    expect(e.html).toContain('Review the copy');
    expect(e.html).toContain('Hero only');
    expect(e.html).toContain('https://app.test/project/d1');
    expect(e.unsubscribeUrl).toBe('https://app.test/explorer?settings=notifications');
  });

  it('escapes user-influenced strings and truncates a long description', () => {
    const e = actionAssignedEmail(
      env,
      '<b>x</b>',
      { id: 'd1', name: 'Roadmap' },
      '<script>',
      'y'.repeat(500),
    );
    expect(e.html).not.toContain('<script>');
    expect(e.html).toContain('&lt;script&gt;');
    expect(e.html).not.toContain('<b>x</b>');
    expect(e.html).not.toContain('y'.repeat(201));
    expect(e.html).toContain(`${'y'.repeat(200)}…`);
  });

  it('falls back when the assigner or plan name is unknown', () => {
    const e = actionAssignedEmail(env, null, { id: 'd1', name: '' }, 'Do it', null);
    expect(e.subject).toMatch(/A teammate/);
    expect(e.html).toContain('a shared plan');
  });

  it('names no plan, and links to none, for an assignee who cannot open it', () => {
    const e = actionAssignedEmail(env, 'Sam', null, 'Review the copy', null);
    expect(e.html).toContain('ask them to share it');
    expect(e.html).not.toContain('/project/');
    expect(e.html).toContain('https://app.test/explorer');
  });
});

describe('mentionedEmail (docs/specs/012-collaboration/comment-mentions.md)', () => {
  it('quotes the comment escaped, and cuts a long one at a word', () => {
    const e = mentionedEmail(env, 'Sam <b>', 'Roadmap', 'd1', 'look <here> please');
    expect(e.kind).toBe('Mentioned');
    expect(e.html).toContain('look &lt;here&gt; please');
    expect(e.html).toContain('Sam &lt;b&gt;');
    const quoted = mentionQuote(`${'word '.repeat(100)}end`);
    expect(quoted.length).toBeLessThanOrEqual(MENTION_QUOTE_CHARS + 1);
    expect(quoted.endsWith('word…')).toBe(true);
  });

  it("opens the card for a card's comment, the plan otherwise", () => {
    const card = mentionedEmail(env, 'Sam', 'Roadmap', 'd1', 'hi', 'it 1');
    expect(card.html).toContain('/project/d1#item=it%201');
    expect(card.html).toContain('Open the card');
    const doc = mentionedEmail(env, 'Sam', 'Roadmap', 'd1', 'hi');
    expect(doc.html).not.toContain('#item=');
    expect(doc.html).toContain('Open the plan');
  });

  it('falls back to "A teammate" without an author name', () =>
    expect(mentionedEmail(env, null, 'Roadmap', 'd1', 'hi').subject).toBe(
      'A teammate mentioned you in Roadmap',
    ));
});

// docs/specs/014-identity/transactional-email.md #6: the milestones.
describe('milestone emails', () => {
  it('celebrates the count, with the opt-out link', () => {
    const e = milestoneEmail(env, 10);
    expect(e.kind).toBe('Milestone');
    expect(e.subject).toBe('You’ve made 10 plans on liveplanner');
    expect(e.unsubscribeUrl).toBe('https://app.test/explorer?settings=notifications');
  });

  it('the first share explains the link controls', () => {
    const e = firstShareEmail(env);
    expect(e.kind).toBe('FirstShare');
    expect(e.html).toContain('Revoke a link any time');
    expect(e.unsubscribeUrl).toBe('https://app.test/explorer?settings=notifications');
  });
});
