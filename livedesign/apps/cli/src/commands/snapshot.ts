// A design as `pull` reads it (docs/specs/015-api/blueprints/cli.md "Pull and push"): its envelope fields, then
// every tab's plain read with its ETag revision, in `orderIndex` order, each kept as a read copy (CLI24) and hashed
// as written.

import { readPlainTab, type VerbContext } from '@livedesign/agent-verbs';
import type { DesignResponse } from '@livedesign/api-schema';
import type { Tab } from '@livedesign/design';
import { CliError } from '../output/cli-error';
import { EXIT } from '@liveworkspace/cli-kit/exit-codes';
import { tabHashes, type PulledTab } from '../sync/pull-file';

type DesignSnapshot = {
  design: { id: string; name: string };
  // Each with its per-design folder when it has one.
  tabs: Tab[];
  pulled: Record<string, PulledTab>;
};

export async function readDesignSnapshot(
  ctx: VerbContext,
  designId: string,
): Promise<DesignSnapshot> {
  const { design } = await ctx.api.json<DesignResponse>(`/designs/${encodeURIComponent(designId)}`);
  const ordered = [...design.tabs].sort((a, b) => a.orderIndex - b.orderIndex);
  const tabs: Tab[] = [];
  const pulled: Record<string, PulledTab> = {};
  for (const summary of ordered) {
    const copy = await readPlainTab(ctx, design.id, summary.id);
    if (!copy)
      throw new CliError({
        exit: EXIT.failure,
        code: 'no_revision',
        message: `the host named no revision for tab ${JSON.stringify(summary.name)}`,
      });
    await ctx.copies?.record(design.id, summary.id, copy);
    const tab = { ...copy.tab, ...(summary.folder ? { folder: summary.folder } : {}) };
    tabs.push(tab);
    pulled[summary.id] = { rev: copy.rev, ...(await tabHashes(tab)) };
  }
  return {
    design: { id: design.id, name: design.name },
    tabs,
    pulled,
  };
}
