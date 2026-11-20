// How the chrome tells a typing commit from a change it shows (docs/specs/007-editor/blueprints/typing.md
// "Performance and limits"). A typing commit hands the page a new view-model whose only change is a tab's writing
// (its `articles`, and for the tab bar its `elements` too) and a new function for every handler, so a reader that
// compares these ways renders for none of them.

import type { Tab } from '@liveknowledge/document';

/** Two tabs that differ at most in the keys of `skip`. */
export function sameTabExcept(a: Tab, b: Tab, skip: ReadonlySet<string>): boolean {
  if (a === b) return true;
  const keys = Object.keys(a) as (keyof Tab)[];
  if (keys.length !== Object.keys(b).length) return false;
  for (const k of keys) {
    if (skip.has(k)) continue;
    if (!Object.is(a[k], b[k])) return false;
  }
  return true;
}

const WRITING = new Set(['articles']);

/** The same tab but for its writing. */
export const sameTabButWriting = (a: Tab, b: Tab): boolean => sameTabExcept(a, b, WRITING);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && Object.getPrototypeOf(v) === Object.prototype;

// One field of a bag: two functions are the same (a handler is read when it runs, never in render); a plain object
// (a bag of handlers and data) is the same while its own fields are, one level down; anything else by identity.
function sameField(a: unknown, b: unknown, nested: boolean): boolean {
  if (typeof a === 'function' && typeof b === 'function') return true;
  if (nested && isPlainObject(a) && isPlainObject(b)) return sameBag(a, b, false);
  return Object.is(a, b);
}

function sameBag(a: Record<string, unknown>, b: Record<string, unknown>, nested: boolean): boolean {
  if (a === b) return true;
  const keys = Object.keys(b);
  if (keys.length !== Object.keys(a).length) return false;
  return keys.every((k) => k in a && sameField(a[k], b[k], nested));
}

/** A host's dependencies (the Quick Style bar's, Find's) with nothing it shows changed: the same handlers by name,
 *  the same data, its `activeTab` the same but for the writing. */
export function sameDepsButWriting<T extends { activeTab: Tab }>(a: T, b: T): boolean {
  if (a === b) return true;
  if (!sameTabButWriting(a.activeTab, b.activeTab)) return false;
  const { activeTab: _a, ...restA } = a;
  const { activeTab: _b, ...restB } = b;
  return sameBag(restA, restB, true);
}

/** Two slices (plain objects of data) with the same fields. */
export function sameSlice<T extends object>(a: T, b: T): boolean {
  if (a === b) return true;
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const keys = Object.keys(y);
  return keys.length === Object.keys(x).length && keys.every((k) => Object.is(x[k], y[k]));
}
