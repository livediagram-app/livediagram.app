// One internal call to the account API with the app's client credentials, shared by account.ts,
// account-settings.ts, workbench.ts and invitations.ts. Worker only: it sends the client secret.
//
// Every call is bounded (liveworkspace/docs/specs/003-accounts/accounts.md "When the accounts site doesn't answer"):
// it goes over the app API's ACCOUNTS binding when the credentials carry it, and gives up at a deadline.

import { accountsFetch, basicAuthorization, type ClientCredentials } from './oauth';
import { withoutTrailingSlashes } from '@liveworkspace/api-schema/url-slashes';

const ACCOUNT_PATH = '/api/account/internal';

// How long a call waits on the accounts Worker. Every read, and every write that is safe to repeat (settings,
// sightings, claims, revokes, activity), answers in well under a second when accounts is up; 10 s is the same as
// the deletion code's and the pages' token asks, and the caller treats it as accounts being out of reach.
export const ACCOUNT_CALL_TIMEOUT_MS = 10_000;
// The writes that would make something twice if repeated (minting an API token, making a team) wait longer, so a
// slow but healthy one is rarely cut, and their timeout says the outcome is unknown (AccountCallTimeout.unconfirmed).
export const ACCOUNT_WRITE_TIMEOUT_MS = 20_000;

/** An AbortSignal that aborts after `ms` with a TimeoutError, on an ordinary timer (so fake timers can drive it,
 *  which AbortSignal.timeout's can't). */
export function deadlineSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(
    () => controller.abort(new DOMException('The operation timed out.', 'TimeoutError')),
    ms,
  );
  return controller.signal;
}

/** An account call that got no answer in time. `unconfirmed`: it was a write that isn't safe to repeat, and it may
 *  have gone through, so the caller must say so rather than answer as if it can simply be tried again. */
export class AccountCallTimeout extends Error {
  readonly unconfirmed: boolean;
  constructor(path: string, ms: number, unconfirmed: boolean) {
    super(
      `account call ${path} got no answer in ${ms} ms${unconfirmed ? '; it may have gone through' : ''}`,
    );
    this.name = 'AccountCallTimeout';
    this.unconfirmed = unconfirmed;
  }
}

export interface CallInit {
  method: 'GET' | 'POST';
  body?: unknown;
  // ACCOUNT_CALL_TIMEOUT_MS unless given.
  timeoutMs?: number;
  // A write that isn't safe to repeat: its timeout is `unconfirmed`.
  notRepeatable?: boolean;
}

// One internal call to the account API with the app's client credentials (also workbench.ts's and
// invitations.ts's).
export async function call(
  credentials: ClientCredentials,
  path: string,
  init: CallInit,
  fetcher: typeof fetch,
): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? ACCOUNT_CALL_TIMEOUT_MS;
  const signal = deadlineSignal(timeoutMs);
  try {
    return await accountsFetch(credentials.accounts, fetcher)(
      `${withoutTrailingSlashes(credentials.accountsUrl)}${ACCOUNT_PATH}${path}`,
      {
        method: init.method,
        headers: {
          authorization: basicAuthorization(credentials),
          accept: 'application/json',
          ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal,
      },
    );
  } catch (err) {
    if (signal.aborted) throw new AccountCallTimeout(path, timeoutMs, init.notRepeatable === true);
    throw err;
  }
}
