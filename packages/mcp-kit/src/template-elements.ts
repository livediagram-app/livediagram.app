// Elements given beside a template on a product's create tool or add_tab (each product's
// docs/specs/015-api/mcp-server.md §4.3): the template builds the tab, then the elements are added to it as the
// update tool's `add` ops would add them, so they land beside the template's own instead of being dropped. The flow
// is one copy here; each product's apps/mcp/src/template-elements.ts binds its own checks and changeset client.

// One `add` op, the shape every product's mcpOpsToEditOperations takes.
export type TemplateAddOp = { op: 'add'; element: Record<string, unknown> };

export type TemplateElementChecks<T> = {
  // Packs a freehand stroke's canvas points (the canvas products); absent, the elements go as given.
  pack?: (elements: readonly unknown[]) => { elements: unknown[] } | { error: string };
  // What is wrong with the elements' values, or null.
  issue: (elements: readonly unknown[]) => string | null;
  // The edit operations the add ops mean against the built tab (an arrow may pin to one of its elements), or what
  // is wrong, prefixed `ops[n]`.
  toOperations: (ops: readonly TemplateAddOp[], built: T) => unknown[] | string;
};

// The add operations for the elements, checked as every other element input is, or what is wrong with them, named
// by its place in `elements` (an `ops[n]` prefix reads `elements[n]`, since the caller gave no ops).
export function templateAddOperations<T>(
  elements: readonly unknown[],
  built: T,
  checks: TemplateElementChecks<T>,
): { operations: unknown[] } | { error: string } {
  const drawn = checks.pack ? checks.pack(elements) : { elements: [...elements] };
  if ('error' in drawn) return { error: drawn.error };
  const issue = checks.issue(drawn.elements);
  if (issue) return { error: issue };
  const operations = checks.toOperations(
    drawn.elements.map((element) => ({ op: 'add', element: element as Record<string, unknown> })),
    built,
  );
  if (typeof operations === 'string')
    return { error: operations.replace(/^ops\[(\d+)\]/, 'elements[$1]') };
  return { operations };
}
