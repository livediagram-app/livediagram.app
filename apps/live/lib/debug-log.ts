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

/** A trace line: `message` carries its fingerprint (`[scope] event`), `details` anything after. */
export function debugLog(message: string, ...details: unknown[]): void {
  const scope = debugScopeOf(message);
  let on = decided.get(scope);
  if (on === undefined) {
    on = debugLogEnabled(scope, process.env.NODE_ENV, browserStore());
    decided.set(scope, on);
  }
  if (on) console.info(message, ...details);
}

/**
 * An inline boot script's logger settings, as data: they reach the script as `data-*` attributes on
 * its own element, never written into its source. Strings, as data attributes are.
 */
export type InlineDebugLogConfig = { scope: string; quiet: 'true' | 'false'; flagKey: string };

/** The settings for `scope`: quiet in a production build unless the debug flag names it. */
export function inlineDebugLogConfig(scope: string): InlineDebugLogConfig {
  return {
    scope,
    quiet: process.env.NODE_ENV === 'production' ? 'true' : 'false',
    flagKey: DEBUG_STORAGE_KEY,
  };
}

/**
 * The same rule for an inline boot script that runs before any module can load (the stale-page
 * guard, stale-html-guard.ts): static ES5 source of `function (config)` returning a
 * `trace(message, detail)` that writes exactly when `debugLog` would. No value is written into it;
 * the config arrives as data (`InlineDebugLogConfig`). It reads `console` and `localStorage` by
 * name, so a test can hand it stubs.
 */
export const INLINE_DEBUG_LOG_SOURCE =
  'function(c){return function(m,d){' +
  "if(c.quiet!=='true'){console.info(m,d);return;}" +
  'try{var f=localStorage.getItem(c.flagKey);if(!f)return;' +
  "var s=f.split(',');for(var i=0;i<s.length;i++){" +
  "var t=s[i].replace(/^\\s+|\\s+$/g,'');" +
  "if(t==='*'||t===c.scope){console.info(m,d);return;}}" +
  '}catch(e){}};}';
