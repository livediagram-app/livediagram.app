// A label scope for a read (docs/specs/030-knowledgebase/search-and-ask.md "By label"; blueprint
// docs/specs/030-knowledgebase/blueprints/page-labels.md "Interfaces and contracts"): the labels a caller names, each
// an id or a name ignoring case, resolved against the knowledgebase's own, and the pages carrying any of them, from
// the summaries the route already holds (no page body is read).
import {
  MAX_KNOWLEDGEBASE_LABELS,
  pageLabelsOf,
  pagesLabelled,
  resolveLabels,
  type KnowledgeLabel,
} from '@liveknowledge/document';
import { json } from '../responses';
import type { DocumentDTO } from '../types';

export type LabelScope = { ids: string[]; tabs: ReadonlySet<string> };

/** The labels a query string names: `labels=a,b` (and repeated `labels=`), each trimmed, empties left out. */
export function labelsParam(params: URLSearchParams): string[] {
  return params
    .getAll('labels')
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean);
}

/** The labels a JSON body names: an array of strings, or none. */
export const labelsOfBody = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

const labelsOf = (document: Pick<DocumentDTO, 'knowledgeSettings'>): readonly KnowledgeLabel[] =>
  document.knowledgeSettings.labels ?? [];

/**
 * The scope `values` name: null when they name nothing (no scope), the pages carrying any of the labels, or a `400
 * unknown_label` naming the labels the knowledgebase has. More values than it could hold labels are refused too.
 */
export function labelScopeOf(
  document: Pick<DocumentDTO, 'knowledgeSettings' | 'tabs'>,
  values: readonly string[],
): LabelScope | null | Response {
  if (values.length === 0) return null;
  const labels = labelsOf(document);
  const resolved =
    values.length > MAX_KNOWLEDGEBASE_LABELS
      ? { unknown: values[MAX_KNOWLEDGEBASE_LABELS]! }
      : resolveLabels(labels, values);
  if ('unknown' in resolved) {
    const known = labels.map((l) => l.name);
    console.info('[knowledge] unknown label', { label: resolved.unknown.slice(0, 40) });
    return json(
      {
        error: 'unknown_label',
        message: known.length
          ? `No label is called "${resolved.unknown.slice(0, 40)}". Labels here: ${known.join(', ')}.`
          : 'This knowledgebase has no labels.',
      },
      { status: 400 },
    );
  }
  return { ids: resolved.ids, tabs: pagesLabelled(document.tabs, resolved.ids) };
}

/** A page's labels by name, for an agent; undefined for none. */
export function labelNamesOf(
  document: Pick<DocumentDTO, 'knowledgeSettings'>,
  ids: unknown,
): string[] | undefined {
  const names = pageLabelsOf(ids, labelsOf(document)).map((l) => l.name);
  return names.length > 0 ? names : undefined;
}
