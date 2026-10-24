import { runInNewContext } from 'node:vm';

/**
 * Runs an inline `<script>`'s source the way a browser runs it: as a classic script, with the
 * language's own built-ins and `globals` as its global scope, and nothing of the test's realm.
 *
 * A boot script ships as a string the page inlines before hydration, so its test runs that very
 * string against stubs (`document`, `localStorage`, a clock) and watches what it does with them.
 * The script's top-level declarations land on a copy of `globals`, never on the caller's object.
 * The Web APIs a page would offer (`URL`, timers) are not there unless handed in like any stub.
 *
 * @param {string} source
 * @param {Record<string, unknown>} [globals]
 * @returns {void}
 */
export function runInlineScript(source, globals = {}) {
  runInNewContext(source, { ...globals });
}
