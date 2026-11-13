// The unsubscribe page talking to the api (docs/specs/026-plan/automations.md "Typed-in addresses"): one plain POST,
// no identity, every failure a value the page can say.
import { API_BASE } from '@liveworkspace/workbench/lib/api/base';

export type OptOutResult = 'done' | 'not_found' | 'error';

export async function sendEmailOptOut(
  planId: string,
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<OptOutResult> {
  try {
    const res = await fetcher(
      `${API_BASE}/email-optout/${encodeURIComponent(planId)}/${encodeURIComponent(token)}`,
      { method: 'POST', cache: 'no-store' },
    );
    if (res.ok) return 'done';
    return res.status === 404 ? 'not_found' : 'error';
  } catch {
    return 'error';
  }
}
