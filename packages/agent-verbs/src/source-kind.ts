// What a `-f` file holds (docs/specs/015-api/blueprints/cli.md CLI71), and the changeset body it becomes:
// edit operations send `{ operations }`; a graph, Mermaid, elements or a whole `replace` send `{ replace }`.

import type { ChangesetRequest } from '@livediagram/api-schema';
import { isRecord, startsWithMermaidHeader } from '@livediagram/document';

export type SourceKind = 'operations' | 'graph' | 'mermaid' | 'elements' | 'replace';

export type ClassifiedSource =
  | { kind: SourceKind; body: Pick<ChangesetRequest, 'operations' | 'replace'> }
  | { kind: 'unknown' };

const isOperation = (value: unknown) => isRecord(value) && 'op' in value;

function wholeJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

export function classifySource(text: string): ClassifiedSource {
  if (text.trim() === '') return { kind: 'unknown' };
  const json = wholeJson(text);
  if (json.ok) {
    const { value } = json;
    if (Array.isArray(value))
      return value.length > 0 && value.every(isOperation)
        ? { kind: 'operations', body: { operations: value } }
        : { kind: 'elements', body: { replace: { elements: value } } };
    if (!isRecord(value)) return { kind: 'unknown' };
    if ('nodes' in value) return { kind: 'graph', body: { replace: { graph: value } } };
    if (isRecord(value.replace)) return { kind: 'replace', body: { replace: value.replace } };
    if (isOperation(value)) return { kind: 'operations', body: { operations: [value] } };
    return { kind: 'unknown' };
  }
  if (startsWithMermaidHeader(text))
    return { kind: 'mermaid', body: { replace: { mermaid: text } } };
  return { kind: 'operations', body: { operations: text } };
}
