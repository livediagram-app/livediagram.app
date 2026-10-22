// A project as `pull` reads it (docs/specs/015-api/blueprints/cli.md "Pull and push"): its envelope fields, then
// every tab's plain read with its ETag revision, in `orderIndex` order, each kept as a read copy (CLI24) and hashed
// as written.

import { readPlainTab, type VerbContext } from '@liveplanner/agent-verbs';
import type { ProjectResponse } from '@liveplanner/api-schema';
import type { Tab } from '@liveplanner/project';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import { tabHashes, type PulledTab } from '../sync/pull-file';

type ProjectSnapshot = {
  project: { id: string; name: string };
  // Each with its per-project folder when it has one.
  tabs: Tab[];
  pulled: Record<string, PulledTab>;
};

export async function readProjectSnapshot(
  ctx: VerbContext,
  projectId: string,
): Promise<ProjectSnapshot> {
  const { project } = await ctx.api.json<ProjectResponse>(
    `/projects/${encodeURIComponent(projectId)}`,
  );
  const ordered = [...project.tabs].sort((a, b) => a.orderIndex - b.orderIndex);
  const tabs: Tab[] = [];
  const pulled: Record<string, PulledTab> = {};
  for (const summary of ordered) {
    const copy = await readPlainTab(ctx, project.id, summary.id);
    if (!copy)
      throw new CliError({
        exit: EXIT.failure,
        code: 'no_revision',
        message: `the host named no revision for tab ${JSON.stringify(summary.name)}`,
      });
    await ctx.copies?.record(project.id, summary.id, copy);
    const tab = { ...copy.tab, ...(summary.folder ? { folder: summary.folder } : {}) };
    tabs.push(tab);
    pulled[summary.id] = { rev: copy.rev, ...(await tabHashes(tab)) };
  }
  return {
    project: { id: project.id, name: project.name },
    tabs,
    pulled,
  };
}
