// An AI draft's call (Describe a Plan, `POST /api/plan-drafts`; Describe a Form, `POST /api/form-drafts`): the person's
// words, answered with a draft. A refusal the api names (one of `codes`) throws a DraftRefusal carrying the api's fixed
// words, which the dialog says as they are; anything else is a failure the dialog says in its own words.

import { API_BASE, apiFetch, apiHeaders, expectOk } from '@/lib/api/core';

export class DraftRefusal<C extends string = string> extends Error {
  readonly status: number;
  readonly code: C;
  constructor(status: number, code: C, message: string) {
    super(message);
    this.name = 'DraftRefusal';
    this.status = status;
    this.code = code;
  }
}

async function refusalOf<C extends string>(
  res: Response,
  codes: readonly C[],
  make: (status: number, code: C, message: string) => DraftRefusal<C>,
): Promise<DraftRefusal<C> | null> {
  try {
    const body = (await res.clone().json()) as { error?: unknown; message?: unknown };
    const code = body.error;
    if (typeof code !== 'string' || !(codes as readonly string[]).includes(code)) return null;
    if (typeof body.message !== 'string') return null;
    return make(res.status, code as C, body.message);
  } catch {
    return null;
  }
}

/** Posts `{ prompt }` to `path` as `ownerId` (their account's token rides apiHeaders). */
export async function postDraft<R, C extends string>(
  path: string,
  ownerId: string,
  prompt: string,
  codes: readonly C[],
  make: (status: number, code: C, message: string) => DraftRefusal<C>,
  what: string,
): Promise<R> {
  const res = await apiFetch(`${API_BASE}/${path}`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const refusal = await refusalOf(res, codes, make);
    if (refusal) throw refusal;
  }
  return expectOk<R>(res, what);
}
