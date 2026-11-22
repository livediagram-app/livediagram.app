// A suggested edit's refusal from its app (./inbox-actions): the status and the error code its body named, for the
// Inbox's pane to say why. Loaded only when an app refuses, so it stays off the Explorer's first load.

/** A verb the app refused: its status and the error code its body named (`{ error }` or `{ code }`), null for
 *  none. */
export class InboxActionError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(status: number, code: string | null) {
    super(`inbox action: ${status}${code ? ` ${code}` : ''}`);
    this.name = 'InboxActionError';
    this.status = status;
    this.code = code;
  }
}

// A refusal's code, from a JSON body of `{ error }` or `{ code }`; null when it has none.
export async function refusalOf(res: Response): Promise<InboxActionError> {
  let code: string | null = null;
  try {
    const b = (await res.json()) as { error?: unknown; code?: unknown } | null;
    const said = b?.error ?? b?.code;
    if (typeof said === 'string') code = said;
  } catch {
    // Not JSON: the status alone.
  }
  return new InboxActionError(res.status, code);
}
