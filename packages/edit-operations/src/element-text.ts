// How the engine quotes elements in result lines and refusals (docs/specs/024-agents/blueprints/
// edit-operations.md "Result lines", EO43): the parts that read no product's element union. Each
// product's `element-text.ts` re-exports these beside its own `kindOf` and `describeElement`.

// An arrow end as far as a line reads it. Each product's `Endpoint` carries more (an anchor, a field
// row, a position along the arrow), all of which a line leaves out.
export type EndRefPoint =
  | { kind: 'free'; x: number; y: number }
  | { kind: 'pinned'; elementId: string }
  | { kind: 'on-arrow'; arrowId: string };

export function labelOf(el: object): string | undefined {
  return 'label' in el && typeof el.label === 'string' && el.label !== '' ? el.label : undefined;
}

// A JSON string cut at `max` code points on a word boundary: whole when the slice ends a word, else
// at its last whitespace, else hard; `…` after the closing quote (VW16).
export function quoteCut(text: string, max: number): string {
  const points = [...text];
  if (points.length <= max) return JSON.stringify(text);
  const slice = points.slice(0, max).join('');
  const space = /\s/.test(points[max]!) ? slice.length : slice.search(/\s\S*$/);
  return `${JSON.stringify((space > 0 ? slice.slice(0, space) : slice).trimEnd())}…`;
}

// An arrow end as results print it: the element or arrow it is attached to, or `@x,y` when free.
export function endRef(end: EndRefPoint, refOf: (id: string) => string = (id) => id): string {
  switch (end.kind) {
    case 'pinned':
      return refOf(end.elementId);
    case 'on-arrow':
      return refOf(end.arrowId);
    case 'free':
      return `@${Math.round(end.x)},${Math.round(end.y)}`;
  }
}
