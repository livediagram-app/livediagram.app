// The error every non-2xx response throws. Carries the HTTP `status`
// AND the api worker's `error` token (`code`) so callers can branch on
// the specific rule that fired (`forbidden` vs `admin_required`,
// `password_invalid`, `gallery_full`, …) instead of re-fetching or
// guessing from the status alone. Before this, every helper threw a
// bare `Error` whose message embedded the status and DROPPED the
// `error` field — the api worker's snake_case error envelope
// (responses.ts) reached the client and went straight in the bin.
//
// `message` keeps the exact `${action} failed: ${status}` shape the
// helpers always threw, so logs and any string-matching callers are
// unaffected; `status` / `code` are purely additive.
export class ApiError extends Error {
  readonly action: string;
  readonly status: number;
  readonly code: string | null;
  constructor(action: string, status: number, code: string | null) {
    super(`${action} failed: ${status}`);
    this.name = 'ApiError';
    this.action = action;
    this.status = status;
    this.code = code;
  }
}
