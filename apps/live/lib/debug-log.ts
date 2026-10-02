// The editor's one logger for trace lines (docs/specs/003-system-architecture/console-logging.md):
// every decision point still logs its fingerprinted line (`[drive-mirror] pass-end`), but a
// production build writes it only when the browser's debug flag asks for it, so a real user's
// console stays clean. Warnings and errors are not trace lines: they use console.warn / .error.

/** The browser's debug flag: `*`, or a comma-separated list of fingerprint scopes. */
export const DEBUG_STORAGE_KEY = 'livediagram:debug';

type FlagStore = Pick<Storage, 'getItem'> | null;

/** A line's scope: the text in its leading brackets, else the word before its first colon. */
export function debugScopeOf(message: string): string {
  const bracketed = /^\[([^\]]+)\]/.exec(message);
  if (bracketed) return bracketed[1]!;
  const prefixed = /^([\w-]+):/.exec(message);
  return prefixed ? prefixed[1]! : '';
}

/** Whether a scope's trace lines show: always outside production, else as the flag says. */
export function debugLogEnabled(scope: string, env: string | undefined, store: FlagStore): boolean {
  if (env !== 'production') return true;
  let flag: string | null;
  try {
    flag = store?.getItem(DEBUG_STORAGE_KEY) ?? null;
  } catch {
    return false;
  }
  if (!flag) return false;
  const scopes = flag.split(',').map((s) => s.trim());
  return scopes.includes('*') || scopes.includes(scope);
}

// The flag is read once per page load (set it, then reload), so a hot path pays one Map lookup.
const decided = new Map<string, boolean>();

function browserStore(): FlagStore {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Whether a scope's trace lines show on this page, for work done only to feed them. */
export function debugScopeOn(scope: string): boolean {
  let on = decided.get(scope);
  if (on === undefined) {
    on = debugLogEnabled(scope, process.env.NODE_ENV, browserStore());
    decided.set(scope, on);
  }
  return on;
}

/** A trace line: `message` carries its fingerprint (`[scope] event`), `details` anything after. */
export function debugLog(message: string, ...details: unknown[]): void {
  if (debugScopeOn(debugScopeOf(message))) console.info(message, ...details);
}
