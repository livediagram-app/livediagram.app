// A D1 binding that is down, as during a Cloudflare D1 incident: every query rejects with D1's own internal error,
// which the request-failure guard answers 503 storage_unavailable (request-failure.ts). Each service's worker test
// hands it to the Worker in place of its database. Not a `.test.ts` file, so vitest doesn't collect it as a suite.

export const D1_INTERNAL_ERROR_MESSAGE = 'D1_ERROR: internal error; reference = test-outage';

export function unavailableD1(): D1Database {
  const fail = () => Promise.reject(new Error(D1_INTERNAL_ERROR_MESSAGE));
  const statement = {
    bind: () => statement,
    first: fail,
    all: fail,
    run: fail,
    raw: fail,
  };
  return {
    prepare: () => statement,
    batch: fail,
    exec: fail,
    dump: fail,
    withSession: () => ({ prepare: () => statement, batch: fail, getBookmark: () => null }),
  };
}
