// A document as `pull` and `sync` read it (docs/specs/015-api/blueprints/cli.md "Pull and push"; repository-link
// blueprint "One sync pass" step 7): its envelope fields, then every tab's plain read with its ETag revision, in
// `orderIndex` order, each kept as a read copy (CLI24, RL15) and hashed as written.

import { readPlainTab, type VerbContext } from '@livediagram/agent-verbs';
import type { DocumentResponse } from '@livediagram/api-schema';
import type { Tab } from '@livediagram/document';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import { tabHashes, type PulledTab } from '../sync/pull-file';

export type DocumentSnapshot = {
  document: { id: string; name: string; presentation: string | null };
  // Each with its per-document folder when it has one.
  tabs: Tab[];
  pulled: Record<string, PulledTab>;
};

export async function readDocumentSnapshot(
  ctx: VerbContext,
  documentId: string,
): Promise<DocumentSnapshot> {
  const { document } = await ctx.api.json<DocumentResponse>(
    `/documents/${encodeURIComponent(documentId)}`,
  );
  const ordered = [...document.tabs].sort((a, b) => a.orderIndex - b.orderIndex);
  const tabs: Tab[] = [];
  const pulled: Record<string, PulledTab> = {};
  for (const summary of ordered) {
    const copy = await readPlainTab(ctx, document.id, summary.id);
    if (!copy)
      throw new CliError({
        exit: EXIT.failure,
        code: 'no_revision',
        message: `the host named no revision for tab ${JSON.stringify(summary.name)}`,
      });
    await ctx.copies?.record(document.id, summary.id, copy);
    const tab = { ...copy.tab, ...(summary.folder ? { folder: summary.folder } : {}) };
    tabs.push(tab);
    pulled[summary.id] = { rev: copy.rev, ...(await tabHashes(tab)) };
  }
  return {
    document: { id: document.id, name: document.name, presentation: document.presentation ?? null },
    tabs,
    pulled,
  };
}
