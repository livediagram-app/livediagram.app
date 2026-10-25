// Read copies (docs/specs/015-api/blueprints/cli.md "Read copies"): the plain tab as this client last read it, at
// a revision. They give a write its base and `tab diff` its before. The store is the CLI's (files); a front door
// without one passes null and writes send no base. Each product binds them to its tab type, its element
// fingerprint and its collection (its copies.ts).

import type { AgentProduct } from './product';
import type { VerbContext } from './define';

export type ReadCopy<Tab> = { rev: number; tab: Tab };

export type ReadCopies<Tab> = {
  latest(fileId: string, tabId: string): Promise<ReadCopy<Tab> | null>;
  at(fileId: string, tabId: string, rev: number): Promise<ReadCopy<Tab> | null>;
  revisions(fileId: string, tabId: string): Promise<number[]>;
  record(fileId: string, tabId: string, copy: ReadCopy<Tab>): Promise<void>;
};

// What a write tells the api it read (each product's api-schema `ChangesetBase`).
export type CopyBase = { rev: number; elements?: Record<string, string> };

type PlainTab = { elements: readonly { id: string }[] };

export type ReadCopiesBinding<Tab extends PlainTab> = {
  product: Pick<AgentProduct, 'collection'>;
  // An element's fingerprint, as the api compares them (CS9).
  fingerprint: (element: Tab['elements'][number]) => string;
  // The revision a tab's weak ETag names; null when it names none.
  revOfEtag: (etag: string | null) => number | null;
};

export function createReadCopies<Tab extends PlainTab>({
  product,
  fingerprint,
  revOfEtag,
}: ReadCopiesBinding<Tab>) {
  type Ctx = Pick<VerbContext<ReadCopies<Tab>>, 'api' | 'copies' | 'log'>;

  // What a write tells the api it read: the revision and every element's fingerprint (CS9).
  function baseFromCopy(copy: ReadCopy<Tab>): CopyBase {
    return {
      rev: copy.rev,
      elements: Object.fromEntries(copy.tab.elements.map((el) => [el.id, fingerprint(el)])),
    };
  }

  const tabUrl = (fileId: string, tabId: string) =>
    `/${product.collection}/${encodeURIComponent(fileId)}/tabs/${encodeURIComponent(tabId)}`;

  // The plain tab and the revision its ETag names; null when the answer names none.
  async function readPlainTab(
    ctx: Pick<Ctx, 'api'>,
    fileId: string,
    tabId: string,
  ): Promise<ReadCopy<Tab> | null> {
    const { body, etag } = await ctx.api.text(tabUrl(fileId, tabId));
    const rev = revOfEtag(etag);
    if (rev === null) return null;
    return { rev, tab: (JSON.parse(body) as { tab: Tab }).tab };
  }

  // Reads the plain tab and keeps it as a read copy; the copy, or null when the store or the revision is absent.
  async function recordCopy(
    ctx: Ctx,
    fileId: string,
    tabId: string,
  ): Promise<ReadCopy<Tab> | null> {
    if (!ctx.copies) return null;
    const copy = await readPlainTab(ctx, fileId, tabId);
    if (!copy) return null;
    await ctx.copies.record(fileId, tabId, copy);
    ctx.log(`copy recorded ${fileId}/${tabId} rev ${copy.rev}`);
    return copy;
  }

  return { baseFromCopy, readPlainTab, recordCopy };
}
