// Read copies (docs/specs/015-api/blueprints/cli.md "Read copies"): the plain tab as this client last read it, at
// a revision. They give a write its base and `tab diff` its before. The store is the CLI's (files); a front door
// without one passes null and writes send no base.

import { revOfEtag, type ChangesetBase } from '@livediagram/api-schema';
import { elementFingerprint, type Tab } from '@livediagram/document';
import type { VerbContext } from './define';

export type ReadCopy = { rev: number; tab: Tab };

export type ReadCopies = {
  latest(documentId: string, tabId: string): Promise<ReadCopy | null>;
  at(documentId: string, tabId: string, rev: number): Promise<ReadCopy | null>;
  revisions(documentId: string, tabId: string): Promise<number[]>;
  record(documentId: string, tabId: string, copy: ReadCopy): Promise<void>;
};

// What a write tells the api it read: the revision and every element's fingerprint (CS9).
export function baseFromCopy(copy: ReadCopy): ChangesetBase {
  return {
    rev: copy.rev,
    elements: Object.fromEntries(copy.tab.elements.map((el) => [el.id, elementFingerprint(el)])),
  };
}

const tabUrl = (documentId: string, tabId: string) =>
  `/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}`;

// The plain tab and the revision its ETag names; null when the answer names none.
export async function readPlainTab(
  ctx: VerbContext,
  documentId: string,
  tabId: string,
): Promise<ReadCopy | null> {
  const { body, etag } = await ctx.api.text(tabUrl(documentId, tabId));
  const rev = revOfEtag(etag);
  if (rev === null) return null;
  return { rev, tab: (JSON.parse(body) as { tab: Tab }).tab };
}

// Reads the plain tab and keeps it as a read copy; the copy, or null when the store or the revision is absent.
export async function recordCopy(
  ctx: VerbContext,
  documentId: string,
  tabId: string,
): Promise<ReadCopy | null> {
  if (!ctx.copies) return null;
  const copy = await readPlainTab(ctx, documentId, tabId);
  if (!copy) return null;
  await ctx.copies.record(documentId, tabId, copy);
  ctx.log(`copy recorded ${documentId}/${tabId} rev ${copy.rev}`);
  return copy;
}
