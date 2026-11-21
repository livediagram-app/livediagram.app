// A rule email's unsubscribe, sent from the app's page (liveworkspace/docs/specs/018-automations/automations.md "Send
// Email"): one plain POST to `<api>/email-optout/:itemId/:token`, no identity, every failure a value the page can say.

export type OptOutResult = 'done' | 'not_found' | 'error';

/** Unsubscribes the address `token` stands for from the item's rule emails. `apiBase`: the app's api, no trailing
 *  slash. */
export async function sendEmailOptOut(
  apiBase: string,
  itemId: string,
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<OptOutResult> {
  try {
    const res = await fetcher(
      `${apiBase}/email-optout/${encodeURIComponent(itemId)}/${encodeURIComponent(token)}`,
      { method: 'POST', cache: 'no-store' },
    );
    if (res.ok) return 'done';
    return res.status === 404 ? 'not_found' : 'error';
  } catch {
    return 'error';
  }
}
