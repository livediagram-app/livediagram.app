// Where Home's links lead (docs/specs/030-knowledgebase/knowledgebase-home.md): a knowledgebase, one of its pages,
// its Ask view, and a new knowledgebase from a structure.
import { knowledgeViewHref } from '@/lib/knowledge-ask/knowledge-view';
import { appHrefOfPlace } from '@/lib/workbench/workspace-place';

const base = (documentId: string) =>
  appHrefOfPlace({ kind: 'document', documentId, tabId: null, shareCode: null });

export const knowledgebaseHref = (documentId: string): string => base(documentId);
export const pageHref = (documentId: string, tab: string): string =>
  `${base(documentId)}#t=${encodeURIComponent(tab)}`;
export const askHref = (documentId: string): string => knowledgeViewHref(base(documentId), 'ask');

export const NEW_KNOWLEDGEBASE_HREF = '/new';
/** A new knowledgebase with nothing in it and its start closed: where an import with no knowledgebase lands. */
export const BLANK_KNOWLEDGEBASE_HREF = '/new?blank=1';
/** A new knowledgebase made from a structure, its whole tree (docs/specs/007-editor/new-document-route.md). */
export const structureHref = (id: string): string => `/new?structure=${encodeURIComponent(id)}`;
