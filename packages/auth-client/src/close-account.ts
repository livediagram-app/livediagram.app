// Closing the person's liveworkspace account from an app's Worker (liveworkspace/docs/specs/003-accounts/sign-in.md
// "Closing an account"). Being signed in is not enough: the accounts Worker emails the account a 6-digit code, the app
// checks the one the person types before deleting its own data, then closes the account with it. Every call sends the
// client secret, so this runs in the app's Worker, with the access token the person signed in to the app with.
//
// The apps' own routes answer the same in every app, so the answers are made here too (`requestDeletionCode`,
// `confirmDeletionCode`): an app's route only wraps them in its own JSON response.
import { accountsRoute, basicAuthorization, type ClientCredentials } from './oauth';

// How long an app waits on the accounts Worker to send or check a code before giving up.
const CODE_TIMEOUT_MS = 10_000;

export type DeletionCodeCheck = 'ok' | 'invalid_code' | 'too_many_attempts' | 'rate_limited';

/** What an app's route answers: its status and JSON body. */
export interface DeletionAnswer {
  status: number;
  body: Record<string, unknown>;
}

export const isDeletionCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9]{6}$/.test(value);

function post(
  credentials: ClientCredentials,
  route: string,
  body: Record<string, string>,
  fetchImpl: typeof fetch,
  timeout = true,
): Promise<Response> {
  return fetchImpl(accountsRoute(credentials.accountsUrl, route), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: basicAuthorization(credentials),
    },
    body: JSON.stringify(body),
    ...(timeout && { signal: AbortSignal.timeout(CODE_TIMEOUT_MS) }),
  });
}

async function failure(what: string, response: Response): Promise<Error> {
  const detail = await response.text().catch(() => '');
  return new Error(`${what} failed (${response.status}): ${detail.slice(0, 200)}`);
}

/** Emails the account a new code. Throws when the accounts Worker refused for any reason but the address's limit. */
export async function sendDeletionCode(
  credentials: ClientCredentials,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<'sent' | 'rate_limited'> {
  const response = await post(
    credentials,
    '/api/auth/delete-account/code',
    { token: accessToken },
    fetchImpl,
  );
  if (response.ok) return 'sent';
  if (response.status === 429) return 'rate_limited';
  throw await failure('sending the deletion code', response);
}

/** Whether `code` is the account's, without spending it. Throws when the accounts Worker couldn't say. */
export async function checkDeletionCode(
  credentials: ClientCredentials,
  accessToken: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DeletionCodeCheck> {
  const response = await post(
    credentials,
    '/api/auth/delete-account/check',
    { token: accessToken, code },
    fetchImpl,
  );
  if (response.ok) return 'ok';
  if (response.status === 429) return 'rate_limited';
  if (response.status === 403) {
    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as { error?: unknown } | null;
    if (body?.error === 'invalid_code' || body?.error === 'too_many_attempts') return body.error;
  }
  throw await failure('checking the deletion code', response);
}

// Closes the person's liveworkspace account, everywhere, with the code emailed to them. Resolves once the account is
// gone; throws when it wasn't closed. No timeout: an account half closed is worse than a slow answer.
export async function closeAccount(
  credentials: ClientCredentials,
  accessToken: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await post(
    credentials,
    '/api/auth/delete-account',
    { token: accessToken, code },
    fetchImpl,
    false,
  );
  if (!response.ok) throw await failure('closing the account', response);
}

const unavailable: DeletionAnswer = { status: 503, body: { error: 'accounts_unavailable' } };
const signedOut: DeletionAnswer = { status: 401, body: { error: 'signed_out' } };
const limited: DeletionAnswer = { status: 429, body: { error: 'rate_limited' } };

/** An app's `POST /api/account/deletion-code`: asks for the code to be emailed. */
export async function requestDeletionCode(
  credentials: ClientCredentials | null,
  accessToken: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<DeletionAnswer> {
  if (!credentials) return unavailable;
  if (!accessToken) return signedOut;
  try {
    const sent = await sendDeletionCode(credentials, accessToken, fetchImpl);
    return sent === 'sent' ? { status: 200, body: { sent: true } } : limited;
  } catch (err) {
    console.warn('[account] code_not_sent', err instanceof Error ? err.message : 'unknown');
    return { status: 502, body: { error: 'code_not_sent' } };
  }
}

/** The code checked out: the app may delete its data, then close the account with the same code. */
export interface ConfirmedDeletion {
  ok: true;
  closeAccount: () => Promise<void>;
}

/**
 * An app's `DELETE /api/account`, before it deletes anything: confirmed when `code` is the account's, else the refusal
 * to answer with. Nothing may be deleted unless it is confirmed.
 */
export async function confirmDeletionCode(
  credentials: ClientCredentials | null,
  accessToken: string | null,
  code: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<ConfirmedDeletion | { ok: false; answer: DeletionAnswer }> {
  const refuse = (answer: DeletionAnswer) => ({ ok: false as const, answer });
  if (!credentials) return refuse(unavailable);
  if (!accessToken) return refuse(signedOut);
  if (!isDeletionCode(code)) return refuse({ status: 400, body: { error: 'code_required' } });
  let checked: DeletionCodeCheck;
  try {
    checked = await checkDeletionCode(credentials, accessToken, code, fetchImpl);
  } catch (err) {
    console.warn('[account] code_not_checked', err instanceof Error ? err.message : 'unknown');
    return refuse({ status: 502, body: { error: 'code_not_checked' } });
  }
  if (checked === 'ok') {
    return {
      ok: true,
      closeAccount: () => closeAccount(credentials, accessToken, code, fetchImpl),
    };
  }
  return refuse(checked === 'rate_limited' ? limited : { status: 403, body: { error: checked } });
}
