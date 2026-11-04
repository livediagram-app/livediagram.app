// What Cloudflare Realtime has cost this month (docs/specs/016-platform/calls-kill-switch.md "The budget poll"):
// one GraphQL Analytics request summing egress bytes from the SFU and TURN datasets since the first of the month,
// priced at $0.05 per GB above the 1,000 GB the two share each month. Realtime bills egress only.

export const REALTIME_FREE_GB = 1_000;
export const REALTIME_USD_PER_GB = 0.05;
export const BYTES_PER_GB = 1e9;
export const ANALYTICS_TIMEOUT_MS = 10_000;

const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';

// One query, one value per dataset: summing per customer or per minute would let sampling skew the total
// (Cloudflare's guidance for billing from these datasets). `limit: 1` with no dimensions is the account's total.
const USAGE_QUERY = `query RealtimeEgress($accountTag: string!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      sfu: callsUsageAdaptiveGroups(limit: 1, filter: { datetimeMinute_geq: $start, datetimeMinute_lt: $end }) {
        sum { egressBytes }
      }
      turn: callsTurnUsageAdaptiveGroups(limit: 1, filter: { datetimeMinute_geq: $start, datetimeMinute_lt: $end }) {
        sum { egressBytes }
      }
    }
  }
}`;

type UsageGroup = { sum?: { egressBytes?: number | null } | null };
type UsageResponse = {
  data?: { viewer?: { accounts?: { sfu?: UsageGroup[]; turn?: UsageGroup[] }[] } } | null;
  errors?: { message?: string }[] | null;
};

/** 00:00 UTC on the first of `now`'s month. */
export function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** `YYYY-MM` of `now`, in UTC: the trip record's month. */
export function monthKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}

/** The month's Realtime cost in dollars above the free tier, rounded to the cent. */
export function realtimeCostUsd(egressBytes: number): number {
  const billableGb = Math.max(0, egressBytes / BYTES_PER_GB - REALTIME_FREE_GB);
  return Math.round(billableGb * REALTIME_USD_PER_GB * 100) / 100;
}

function groupBytes(groups: UsageGroup[] | undefined): number {
  return (groups ?? []).reduce((total, g) => total + (g.sum?.egressBytes ?? 0), 0);
}

/**
 * The account's Realtime egress bytes (SFU plus TURN) from the start of `now`'s month to `now`. Throws on any
 * failure (network, timeout, a non-2xx answer, GraphQL errors), so the poll leaves the switch alone.
 */
export async function fetchRealtimeEgressBytes(opts: {
  accountId: string;
  token: string;
  now: Date;
  fetchImpl?: typeof fetch;
}): Promise<number> {
  const doFetch = opts.fetchImpl ?? fetch;
  const response = await doFetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${opts.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: USAGE_QUERY,
      variables: {
        accountTag: opts.accountId,
        start: monthStartUtc(opts.now).toISOString(),
        end: opts.now.toISOString(),
      },
    }),
    signal: AbortSignal.timeout(ANALYTICS_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Realtime analytics answered ${response.status}`);
  const body = (await response.json()) as UsageResponse;
  if (body.errors && body.errors.length > 0) {
    throw new Error(`Realtime analytics: ${body.errors.map((e) => e.message ?? '').join('; ')}`);
  }
  const account = body.data?.viewer?.accounts?.[0];
  if (!account) throw new Error('Realtime analytics: no such account');
  return groupBytes(account.sfu) + groupBytes(account.turn);
}
