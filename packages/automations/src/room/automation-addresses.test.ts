import { describe, expect, it, vi } from 'vitest';
import { AUTOMATION_ADDRESS_EMAILS_PER_DAY } from '../limits';
import {
  OPTOUT_TOKEN,
  addressEmailsToday,
  claimAddresses,
  optOutAddress,
  sendToAddresses,
} from './automation-addresses';
import { rowsOf, testSql } from './test-sql';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 100 * DAY + 5;

describe('claiming a step’s addresses', () => {
  it('gives each its own unguessable token, kept for the next email', () => {
    const sql = testSql();
    const first = claimAddresses(sql, ['a@x.example', 'b@x.example'], NOW);
    expect(first.unsubscribed).toEqual([]);
    expect(first.capped).toBe(0);
    for (const s of first.send) expect(s.token).toMatch(OPTOUT_TOKEN);
    expect(first.send[0]!.token).not.toBe(first.send[1]!.token);
    const again = claimAddresses(sql, ['a@x.example'], NOW);
    expect(again.send).toEqual([first.send[0]]);
    expect(addressEmailsToday(sql, NOW)).toBe(3);
  });

  it('counts against the day’s limit as far as it goes, and forgets days before yesterday', () => {
    const sql = testSql();
    claimAddresses(sql, ['old@x.example'], NOW - 3 * DAY);
    const claim = claimAddresses(sql, ['a@x.example', 'b@x.example', 'c@x.example'], NOW, 2);
    expect(claim.send.map((s) => s.address)).toEqual(['a@x.example', 'b@x.example']);
    expect(claim.capped).toBe(1);
    expect(claimAddresses(sql, ['d@x.example'], NOW, 2)).toEqual({
      send: [],
      unsubscribed: [],
      capped: 1,
    });
    expect(rowsOf(sql, 'SELECT day FROM automation_email_days')).toHaveLength(1);
    expect(addressEmailsToday(sql, NOW + DAY)).toBe(0);
    expect(AUTOMATION_ADDRESS_EMAILS_PER_DAY).toBe(50);
  });

  it('passes over an address that unsubscribed, for good', () => {
    const sql = testSql();
    const { send } = claimAddresses(sql, ['a@x.example'], NOW);
    expect(optOutAddress(sql, send[0]!.token, NOW + 1)).toBe(true);
    expect(optOutAddress(sql, send[0]!.token, NOW + 2)).toBe(true);
    expect(rowsOf(sql, 'SELECT unsubscribed_at FROM automation_email_addresses')[0]).toEqual({
      unsubscribed_at: NOW + 1,
    });
    expect(claimAddresses(sql, ['a@x.example', 'b@x.example'], NOW)).toMatchObject({
      unsubscribed: ['a@x.example'],
      send: [{ address: 'b@x.example' }],
    });
  });

  it('refuses a token it never made', () => {
    const sql = testSql();
    expect(optOutAddress(sql, 'short', NOW)).toBe(false);
    expect(optOutAddress(sql, 'x'.repeat(43), NOW)).toBe(false);
  });

  it('throws, claiming nothing, when the day’s count cannot be read', () => {
    const sql = testSql();
    sql.exec('INSERT INTO automation_email_days (day, sent) VALUES (?, ?)', 100 * DAY, -1);
    expect(() => claimAddresses(sql, ['a@x.example'], NOW)).toThrow('unreadable');
    expect(rowsOf(sql, 'SELECT address FROM automation_email_addresses')).toEqual([]);
  });
});

describe('emailing the claimed addresses', () => {
  it('sends each one its own email, with its own unsubscribe links', async () => {
    const sent: { to: string; mail: string }[] = [];
    await sendToAddresses(
      {
        optOutDoor: (token) => `door/${token}`,
        optOutPage: (token) => `page/${token}`,
        compose: (links) => `${links.unsubscribeUrl} ${links.unsubscribePage}`,
        send: async (to, mail) => {
          sent.push({ to, mail });
        },
      },
      [
        { address: 'a@x.example', token: 't1' },
        { address: 'b@x.example', token: 't2' },
      ],
    );
    expect(sent).toEqual([
      { to: 'a@x.example', mail: 'door/t1 page/t1' },
      { to: 'b@x.example', mail: 'door/t2 page/t2' },
    ]);
  });

  it('never throws: an address whose send throws or answers false is listed, and the rest still go', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const answers: Record<string, () => Promise<unknown>> = {
      'a@x.example': () => Promise.reject(new Error('refused')),
      'b@x.example': () => Promise.resolve(false),
      'c@x.example': () => Promise.resolve({ sent: true }),
      'd@x.example': () => Promise.resolve({ sent: false }),
    };
    const out = await sendToAddresses(
      {
        optOutDoor: (token) => token,
        optOutPage: (token) => token,
        compose: () => 'mail',
        send: (to) => answers[to]!(),
      },
      ['a', 'b', 'c', 'd'].map((n) => ({ address: `${n}@x.example`, token: n })),
    );
    expect(out).toEqual({
      sent: ['c@x.example'],
      failed: ['a@x.example', 'b@x.example', 'd@x.example'],
    });
    expect(warn).toHaveBeenCalledOnce();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('a@x.example');
  });
});
