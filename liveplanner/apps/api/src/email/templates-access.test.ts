import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import { accessGrantedEmail, accessRequestedEmail } from './templates';

// Request Access's two emails in this app's look and noun (liveworkspace request-access.md "The emails").
const env = { APP_BASE_URL: 'https://app.test' } as unknown as Env;
const REQUEST = {
  requestId: 'req_1',
  requesterName: 'Ana',
  item: { id: 'item 1', name: 'Launch' },
  note: 'On the team',
};

describe('the access requested email', () => {
  it('names who asks and the plan, quotes the note, and opens the request with the footer to turn it off', () => {
    const email = accessRequestedEmail(env, REQUEST);
    expect(email.kind).toBe('AccessRequested');
    expect(email.subject).toBe('Ana asked for access to Launch');
    expect(email.html).toContain('a plan you manage');
    expect(email.html).toContain('“On the team”');
    expect(email.html).toContain('href="https://app.test/explorer/inbox?at=r%3Areq_1"');
    expect(email.html).toContain('Manage your notifications');
    expect(email.unsubscribeUrl).toBe('https://app.test/explorer?settings=notifications');
  });
});

describe('the access granted email', () => {
  it('names who shared the plan and opens it, with no switch to turn it off', () => {
    const email = accessGrantedEmail(env, {
      granterName: 'Bo',
      item: { id: 'item 1', name: 'Launch' },
      level: 'participate',
    });
    expect(email.kind).toBe('AccessGranted');
    expect(email.subject).toBe('Bo shared Launch with you');
    expect(email.html).toContain('as a Participant');
    expect(email.html).toContain('href="https://app.test/project/item%201"');
    expect(email.html).toContain('Open the plan');
    expect(email.html).not.toContain('Manage your notifications');
    expect('unsubscribeUrl' in email).toBe(false);
  });
});
