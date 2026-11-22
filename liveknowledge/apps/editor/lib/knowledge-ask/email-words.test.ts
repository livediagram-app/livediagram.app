import { describe, expect, it } from 'vitest';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import {
  emailFailureText,
  emailResultText,
  ownersEmailedText,
  remindedThisWeek,
} from './email-words';

// docs/specs/030-knowledgebase/ai-knowledge.md: what an Editor reads after asking for an email.
const NOW = new Date(2026, 10, 20, 12).getTime();
const DAY = 86_400_000;

describe('what happened, in words', () => {
  it('says how many owners were emailed', () => {
    expect(emailResultText({ outcome: 'sent', sent: 2, owners: 2 }, 'ask', NOW)).toBe(
      'Sent to 2 owners.',
    );
    expect(emailResultText({ outcome: 'sent', sent: 1, owners: 1 }, 'remind', NOW)).toBe(
      'Sent to 1 owner.',
    );
    expect(emailResultText({ outcome: 'sent', sent: 1, owners: 3 }, 'remind', NOW)).toBe(
      'Sent to 1 of 3 owners. The rest have these emails turned off, have no verified address or can no longer open this knowledgebase.',
    );
  });

  it('says when it was already sent, and when the owners can be reminded again', () => {
    expect(emailResultText({ outcome: 'already_sent', sentAt: NOW - 6 * DAY }, 'ask', NOW)).toBe(
      'The owners were already asked on 14 Nov.',
    );
    expect(
      emailResultText(
        { outcome: 'already_sent', sentAt: NOW - 2 * DAY, nextAt: NOW + 5 * DAY },
        'remind',
        NOW,
      ),
    ).toBe('The owners were already reminded this week. They can be reminded again on 25 Nov.');
    expect(emailResultText({ outcome: 'already_sent', sentAt: NOW }, 'remind', NOW)).toBe(
      'The owners were already reminded this week.',
    );
  });

  it('says why nothing was sent', () => {
    expect(emailResultText({ outcome: 'no_owners' }, 'ask', NOW)).toBe(
      'Neither page has an owner to ask. Set one in Page Health.',
    );
    expect(emailResultText({ outcome: 'no_owners' }, 'remind', NOW)).toBe(
      'None of the pages to review has an owner. Set one in Page Health.',
    );
    expect(emailResultText({ outcome: 'nothing_due' }, 'remind', NOW)).toBe(
      'Every page is verified, so there is nobody to remind.',
    );
    expect(emailResultText({ outcome: 'no_recipients' }, 'ask', NOW)).toContain(
      'No email was sent: the owners have these emails turned off',
    );
    expect(emailResultText({ outcome: 'daily_limit' }, 'remind', NOW)).toBe(
      'This knowledgebase has sent all its review emails for today. Try again tomorrow.',
    );
    expect(emailResultText({ outcome: 'unavailable' }, 'ask', NOW)).toBe(
      'This server does not send email.',
    );
  });

  it('words a request that failed', () => {
    expect(emailFailureText(new ApiError('ask owners', 404, 'conflict_unknown'), 'ask')).toBe(
      'This disagreement has closed since: one of the passages changed.',
    );
    expect(emailFailureText(new ApiError('remind owners', 403, 'forbidden'), 'remind')).toBe(
      'Only a signed-in Editor can email the owners.',
    );
    expect(emailFailureText(new Error('offline'), 'ask')).toContain('could not be asked');
    expect(emailFailureText(new Error('offline'), 'remind')).toContain('could not be reminded');
  });

  it('stands in for the button once the email has gone, for a week of reminders', () => {
    expect(ownersEmailedText('ask', NOW - 6 * DAY, NOW)).toBe('Owners asked 14 Nov');
    expect(ownersEmailedText('remind', NOW - 6 * DAY, NOW)).toBe('Owners reminded 14 Nov');
    expect(remindedThisWeek(undefined, NOW)).toBe(false);
    expect(remindedThisWeek(NOW - 6 * DAY, NOW)).toBe(true);
    expect(remindedThisWeek(NOW - 7 * DAY, NOW)).toBe(false);
  });
});
