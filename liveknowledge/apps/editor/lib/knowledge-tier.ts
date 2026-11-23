// What the knowledgebase's tier sets, as its last read said (docs/specs/030-knowledgebase/tiers.md): the most pages,
// the days of history kept and who an upgrade is for. One small store per page, fed by the document's load, so the
// tree, the import panel and AI Knowledge read the same figures. Nothing is held with Pro off.
import type { KnowledgeTierInfo } from '@liveknowledge/api-schema';
import { MAX_KNOWLEDGEBASE_PAGES } from '@liveknowledge/document';
import type { PagesBound } from './knowledge-import/import-trim';

const tiers = new Map<string, KnowledgeTierInfo>();
const listeners = new Set<() => void>();
// The knowledgebase the editor opened last: the page has one open, and every page-add check reads its limit.
let open: string | null = null;

export function setKnowledgeTier(documentId: string, info: KnowledgeTierInfo | null): void {
  const before = tiers.get(documentId);
  open = documentId;
  if (info) tiers.set(documentId, info);
  else tiers.delete(documentId);
  if (JSON.stringify(before) !== JSON.stringify(info ?? undefined))
    for (const tell of listeners) tell();
}

/** Hears every change to the store; the hooks' `subscribe`. */
export const subscribe = (tell: () => void) => {
  listeners.add(tell);
  return () => {
    listeners.delete(tell);
  };
};

export function knowledgeTierOf(documentId: string | null | undefined): KnowledgeTierInfo | null {
  return (documentId && tiers.get(documentId)) || null;
}

/** The most pages the knowledgebase holds: its tier's, or 500 with Pro off. */
export const pagesMaxOf = (documentId: string | null | undefined): number =>
  knowledgeTierOf(documentId)?.pagesMax ?? MAX_KNOWLEDGEBASE_PAGES;

// The open knowledgebase's bound with its owner's Knowledgebase Pages over every knowledgebase of theirs (tiers.md
// "Knowledgebase Pages"), fed by the page tree (`useFeedOpenPagesBound`) once the owner's usage is known; null until
// then, with Pro off, and for anyone the owner's usage is not theirs to see.
let openBound: { documentId: string; bound: PagesBound } | null = null;
const boundWaiters = new Set<() => void>();

export function setOpenPagesBound(documentId: string | null, bound: PagesBound | null): void {
  openBound = documentId && bound ? { documentId, bound } : null;
  if (openBound) for (const done of boundWaiters) done();
}

/** What bounds the open knowledgebase's pages, when its owner's usage is known here. */
export const openPagesBound = (): PagesBound | null =>
  openBound && openBound.documentId === open ? openBound.bound : null;

/** Resolves once the open knowledgebase's bound is known, or after `ms`: a page add asked before then waits for it. */
export function whenOpenPagesBound(ms: number): Promise<void> {
  if (openPagesBound()) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      boundWaiters.delete(done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, ms);
    boundWaiters.add(done);
  });
}

/** The most pages the open knowledgebase holds: its fixed bound, or less where its owner's limit leaves less room. */
export const openPagesMax = (): number =>
  Math.min(pagesMaxOf(open), openPagesBound()?.max ?? Number.POSITIVE_INFINITY);

/** The knowledgebase open on this page. */
export const openKnowledgebase = (): string | null => open;

/** Tests only. */
export function forgetKnowledgeTiersForTests(): void {
  tiers.clear();
  open = null;
  openBound = null;
  boundWaiters.clear();
}
