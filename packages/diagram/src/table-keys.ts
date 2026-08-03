// Test support: the keys of a lookup table, typed as its union.
//
// The preset tables here are each `Record<SomeUnion, X>`, so their keys ARE
// the union. A test that wants to check "every preset maps to a sane value"
// should iterate this rather than type the members out, because a typed-out
// list silently stops being every preset the day the union grows: the radius
// test read ['none', 'sm', 'md', 'lg'] long after BorderRadius gained 'full',
// and nothing failed, because a list that omits a case still tests the cases
// it kept.
//
// TypeScript already catches a table MISSING a key. It cannot catch a key that
// exists and maps to a nonsense value, which is the half these tests own.
//
// Deliberately not exported from index.ts: this is for the package's own
// tests, not part of the public surface.
export const tableKeys = <K extends string>(table: Record<K, unknown>): K[] =>
  Object.keys(table) as K[];
