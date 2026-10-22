// Short names for documents and tabs (docs/specs/015-api/blueprints/cli.md CLI20): the shortest prefix of each
// id unique among its neighbours, at least REF_MIN_PREFIX characters, as the views name elements.

export const REF_MIN_PREFIX = 4;

function shared(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// Ids are unique, so the order never meets a tie.
export function shortestUniquePrefixes(ids: readonly string[]): Map<string, string> {
  const sorted = [...ids].sort((a, b) => (a < b ? -1 : 1));
  return new Map(
    sorted.map((id, i) => {
      const longest = Math.max(
        i > 0 ? shared(id, sorted[i - 1]!) : 0,
        i < sorted.length - 1 ? shared(id, sorted[i + 1]!) : 0,
      );
      return [id, id.slice(0, Math.max(REF_MIN_PREFIX, longest + 1))];
    }),
  );
}
