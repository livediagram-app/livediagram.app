// What an editor hears back from its api when the person deletes their account (each product's
// docs/specs/014-identity/auth-and-guest-access.md "Deleting an account"): the code emailed first, then the delete.
// Every app's api answers the same (@liveworkspace/auth-client makes the answers), so it is read once, here.

export type DeletionCodeSent = 'sent' | 'rate_limited' | 'failed';

export type AccountDeletion =
  | 'deleted'
  // The data went, but closing the liveworkspace account failed: asking again finishes it.
  | 'account_not_closed'
  | 'invalid_code'
  // The code died on its third wrong try: the person asks for a new one.
  | 'too_many_attempts'
  | 'rate_limited'
  | 'failed';

async function errorOf(res: Response): Promise<unknown> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return body?.error;
}

/** `POST /api/account/deletion-code`'s answer. */
export function deletionCodeSentOf(res: Response): DeletionCodeSent {
  if (res.ok) return 'sent';
  return res.status === 429 ? 'rate_limited' : 'failed';
}

/** `DELETE /api/account`'s answer. */
export async function accountDeletionOf(res: Response): Promise<AccountDeletion> {
  if (res.ok) return 'deleted';
  if (res.status === 429) return 'rate_limited';
  const error = await errorOf(res);
  if (res.status === 502 && error === 'account_not_closed') return 'account_not_closed';
  if (res.status === 403 && (error === 'invalid_code' || error === 'too_many_attempts')) {
    return error;
  }
  return 'failed';
}
