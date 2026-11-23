import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import { readingReminderEmail } from './reading-reminder-email';

// docs/specs/030-knowledgebase/required-reading.md "Remind": who asked, the page as a link, the settings link.
const env = { APP_BASE_URL: 'https://app.test' } as unknown as Env;
const kb = { id: 'kb 1', name: 'Handbook <Team>' };

describe('readingReminderEmail', () => {
  it('names who asked and links the page, escaped, with the way to turn it off', () => {
    const email = readingReminderEmail(
      env,
      kb,
      { tab: 'p/1', title: 'Expenses & <Travel>' },
      'Priya',
    );
    expect(email.kind).toBe('ReadingReminder');
    expect(email.subject).toBe('Please Read Expenses & <Travel>');
    expect(email.html).toContain('Please Read Expenses &amp; &lt;Travel&gt;');
    expect(email.html).toContain('<strong>Priya</strong> asked you to read');
    expect(email.html).toContain('https://app.test/document/kb%201#t=p%2F1');
    expect(email.html).toContain('Handbook &lt;Team&gt;');
    expect(email.html).not.toContain('<Travel>');
    expect(email.text).toContain(
      'Priya asked you to read Expenses & <Travel> in Handbook <Team>, and to confirm once you have.',
    );
    expect(email.text).toContain('Read the page: https://app.test/document/kb%201#t=p%2F1');
    expect(email.text).toContain('https://app.test/explorer?settings=notifications');
    expect(email.unsubscribeUrl).toBe('https://app.test/explorer?settings=notifications');
  });

  it('falls back for an empty title, knowledgebase and sender, and flattens a title to one line', () => {
    const email = readingReminderEmail(env, { id: 'kb', name: ' ' }, { tab: 't', title: '' }, '');
    expect(email.subject).toBe('Please Read Untitled Page');
    expect(email.text).toContain('An Editor asked you to read Untitled Page in a knowledgebase');
    const flat = readingReminderEmail(env, kb, { tab: 't', title: 'Line one\nline two' }, 'Sam');
    expect(flat.subject).toBe('Please Read Line one line two');
  });
});
