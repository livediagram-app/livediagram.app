// A replace's sources record (docs/specs/027-repositories/diagram-sources.md "Writing the record"; blueprint
// edit-operations.md "Replace"): the files a tab was drawn from, written with the elements they describe. With a
// graph body the engine works out what each node and edge became from what it drew; with an elements body the
// caller, who merged them, says so. Anything that does not read whole as a record is refused, never half kept.

import type { EditRejection } from '@livediagram/api-schema';
import {
  isRecord,
  tabSourcesOf,
  type DiagramSources,
  type Element,
  type GraphInput,
} from '@livediagram/document';
import { drawnRecord, INFRA_SOURCES_MAX_STORED_CHARS } from '@livediagram/document/infra-code';

const refusal = (detail: string): EditRejection => ({
  code: 'invalid_value',
  details: [`replace.sources: ${detail}`],
  hint: 'sources is { bridge: "infra", files, env?, nodes?, edges? }: livediagram guide build',
});

// Read back, the record's nodes and edges are tables (tabSourcesOf refuses others), so they are counted as such.
const count = (v: unknown) => Object.keys(v as object).length;

/** The record the replace writes, or the refusal naming what is wrong with it. */
export function replaceSourcesOf(
  raw: unknown,
  body: { source: 'graph' | 'mermaid' | 'template' | 'elements'; graph?: GraphInput },
  elements: readonly Element[],
  now: number,
): DiagramSources | EditRejection {
  if (!isRecord(raw)) return refusal('expected an object');
  if (body.source === 'mermaid' || body.source === 'template')
    return refusal('a record comes with a graph or elements, not with Mermaid or a template');
  const drawn = body.source === 'graph';
  if (drawn && (raw.nodes !== undefined || raw.edges !== undefined))
    return refusal('with a graph, nodes and edges are worked out from the drawing; leave them out');
  if (!drawn && (raw.nodes === undefined || raw.edges === undefined))
    return refusal('with elements, nodes and edges say what each element was drawn from');
  if (raw.env !== undefined && typeof raw.env !== 'string') return refusal('env must be a string');
  const derived = drawn
    ? drawnRecord(elements, body.graph!)
    : { nodes: raw.nodes, edges: raw.edges };
  const candidate = { ...raw, ...derived, readAt: now };
  const read = tabSourcesOf({ sources: candidate });
  // Read back whole: a file, node or edge the reader drops is a malformed record, not one to keep in part.
  if (
    !read ||
    !Array.isArray(raw.files) ||
    read.files.length !== raw.files.length ||
    Object.keys(read.nodes).length !== count(derived.nodes) ||
    Object.keys(read.edges).length !== count(derived.edges)
  )
    return refusal('not a sources record');
  const stored = read.files.reduce((n, f) => n + (f.text?.length ?? 0), 0);
  if (stored > INFRA_SOURCES_MAX_STORED_CHARS)
    return refusal(
      `the files' texts are ${stored} characters, past the ${INFRA_SOURCES_MAX_STORED_CHARS} a tab remembers; send the rest without text`,
    );
  return read;
}
