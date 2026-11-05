// A D1 outage that Better Auth answers itself (liveworkspace/docs/specs/003-accounts/sign-in.md "Deploys"): it
// catches every error inside its handler and API calls, so a session lookup with D1 down comes back as a 500 or as
// no session, never as the throw the request-failure guard turns into 503. Its D1 handle notes the outage for the
// request it happened in, and the request rethrows it when its answer is an error.
import { AsyncLocalStorage } from 'node:async_hooks';
import { storageOutageOf } from '@liveworkspace/api-kit/request-failure';

type Watch = { outage?: Error };

const current = new AsyncLocalStorage<Watch>();

function note(err: unknown): void {
  const watch = current.getStore();
  if (watch && !watch.outage && storageOutageOf(err)) watch.outage = err as Error;
}

// Every method of the database and of what it hands back (statements, sessions): a throw or a rejection is noted
// and passed on unchanged.
function watched<T extends object>(target: T): T {
  return new Proxy(target, {
    get(obj, key) {
      const value: unknown = Reflect.get(obj, key, obj);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        let out: unknown;
        try {
          out = value.apply(obj, args);
        } catch (err) {
          note(err);
          throw err;
        }
        if (out instanceof Promise) {
          return out.catch((err: unknown) => {
            note(err);
            throw err;
          });
        }
        return out !== null && typeof out === 'object' ? watched(out) : out;
      };
    },
  });
}

/** The D1 handle Better Auth is given: the same database, noting an outage for the request it happened in. */
export function watchedD1(db: D1Database): D1Database {
  return watched(db);
}

/** Runs one request. If D1 was unavailable during it and the answer is an error, the outage is thrown instead, for
 *  the request-failure guard to answer as 503. A request that still answered well keeps its answer. */
export async function withD1OutageWatch(run: () => Promise<Response>): Promise<Response> {
  const watch: Watch = {};
  const response = await current.run(watch, run);
  if (watch.outage && response.status >= 400) throw watch.outage;
  return response;
}
