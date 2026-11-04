import { describe, expect, it, vi } from 'vitest';
import {
  fetchRealtimeEgressBytes,
  monthKey,
  monthStartUtc,
  realtimeCostUsd,
} from './realtime-usage';

const NOW = new Date('2026-11-04T13:45:00.000Z');

function answer(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
}

describe('the month', () => {
  it('starts at 00:00 UTC on the first', () => {
    expect(monthStartUtc(NOW).toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(monthKey(NOW)).toBe('2026-11');
  });
});

describe('realtimeCostUsd', () => {
  it('is nothing inside the free 1,000 GB', () => {
    expect(realtimeCostUsd(0)).toBe(0);
    expect(realtimeCostUsd(1_000e9)).toBe(0);
  });

  it('is $0.05 a GB above it', () => {
    expect(realtimeCostUsd(1_200e9)).toBe(10);
    expect(realtimeCostUsd(1_500e9)).toBe(25);
    expect(realtimeCostUsd(1_000e9 + 1e9 / 3)).toBe(0.02);
  });
});

describe('fetchRealtimeEgressBytes', () => {
  it('asks once for the month so far and sums SFU and TURN egress', async () => {
    const fetchImpl = answer({
      data: {
        viewer: {
          accounts: [
            { sfu: [{ sum: { egressBytes: 700e9 } }], turn: [{ sum: { egressBytes: 50e9 } }] },
          ],
        },
      },
    });
    const bytes = await fetchRealtimeEgressBytes({
      accountId: 'acct',
      token: 'tok',
      now: NOW,
      fetchImpl,
    });
    expect(bytes).toBe(750e9);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    const sent = JSON.parse(init!.body as string) as { variables: unknown; query: string };
    expect(sent.variables).toEqual({
      accountTag: 'acct',
      start: '2026-11-01T00:00:00.000Z',
      end: '2026-11-04T13:45:00.000Z',
    });
    expect(sent.query).toContain('callsUsageAdaptiveGroups');
    expect(sent.query).toContain('callsTurnUsageAdaptiveGroups');
  });

  it('counts a dataset with no rows, or no sum, as nothing', async () => {
    const fetchImpl = answer({
      data: {
        viewer: { accounts: [{ sfu: [], turn: [{ sum: null }, { sum: { egressBytes: null } }] }] },
      },
    });
    expect(
      await fetchRealtimeEgressBytes({ accountId: 'a', token: 't', now: NOW, fetchImpl }),
    ).toBe(0);
    const empty = answer({ data: { viewer: { accounts: [{}] } } });
    expect(
      await fetchRealtimeEgressBytes({ accountId: 'a', token: 't', now: NOW, fetchImpl: empty }),
    ).toBe(0);
  });

  it('throws on a non-2xx answer', async () => {
    await expect(
      fetchRealtimeEgressBytes({
        accountId: 'a',
        token: 't',
        now: NOW,
        fetchImpl: answer({}, 403),
      }),
    ).rejects.toThrow('403');
  });

  it('throws on GraphQL errors', async () => {
    await expect(
      fetchRealtimeEgressBytes({
        accountId: 'a',
        token: 't',
        now: NOW,
        fetchImpl: answer({ data: null, errors: [{ message: 'not authorized' }, {}] }),
      }),
    ).rejects.toThrow('not authorized');
  });

  it('throws when the account is not in the answer', async () => {
    await expect(
      fetchRealtimeEgressBytes({
        accountId: 'a',
        token: 't',
        now: NOW,
        fetchImpl: answer({ data: {} }),
      }),
    ).rejects.toThrow('no such account');
  });

  it('uses the global fetch when none is given', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ data: { viewer: { accounts: [{}] } } })));
    expect(await fetchRealtimeEgressBytes({ accountId: 'a', token: 't', now: NOW })).toBe(0);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
