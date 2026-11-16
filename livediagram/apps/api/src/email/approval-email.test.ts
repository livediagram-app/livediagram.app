// The approval request's email (liveworkspace/docs/specs/004-index/approvals.md "The email").
import { describe, expect, it } from 'vitest';
import type { Env } from '../types';
import { approvalRequestedEmail } from './templates';

const env = { APP_BASE_URL: 'https://app.test' } as unknown as Env;

describe('approvalRequestedEmail', () => {
  it('names who asked, the canvas, the day and the note, and opens the canvas', () => {
    const email = approvalRequestedEmail(env, {
      requesterName: 'Ada <Lovelace>',
      item: { id: 'item 1', name: 'Q3 & Q4' },
      note: 'Check the dates',
      due: '2026-11-20',
    });
    expect(email.kind).toBe('ApprovalRequested');
    expect(email.subject).toBe('Ada <Lovelace> asked you to approve Q3 & Q4');
    expect(email.html).toContain('<strong>Ada &lt;Lovelace&gt;</strong> asked you to approve');
    expect(email.html).toContain(
      '<strong>Q3 &amp; Q4</strong> by <strong>20 November 2026</strong>',
    );
    expect(email.html).toContain('Check the dates');
    expect(email.html).toContain('https://app.test/document/item%201');
    expect(email.unsubscribeUrl).toEqual(expect.any(String));
  });

  it('says a teammate and a shared canvas when it knows neither, and cuts a long note', () => {
    const email = approvalRequestedEmail(env, {
      requesterName: null,
      item: { id: 'i', name: '  ' },
      note: 'x'.repeat(300),
      due: null,
    });
    expect(email.subject).toBe('A teammate asked you to approve a canvas');
    expect(email.html).toContain('<strong>a shared canvas</strong>. Open it');
    expect(email.html).toContain(`${'x'.repeat(200)}…`);
    const bare = approvalRequestedEmail(env, {
      requesterName: ' ',
      item: { id: 'i', name: 'Plan' },
      note: null,
      due: null,
    });
    expect(bare.html).not.toContain('…');
  });
});
