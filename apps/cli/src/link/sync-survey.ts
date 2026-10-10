// Steps 2 to 6 of a pass (docs/specs/027-repositories/blueprints/repository-link.md "One sync pass"): the local
// sync state, coverage, the scan, the api's answers and the plan, read and written nothing. `sync` acts on it;
// `link status` prints it.

import type { VerbContext } from '@livediagram/agent-verbs';
import type { CliIo } from '../io';
import { readCoverage, type Coverage } from './coverage';
import type { LinkFile } from './link-file';
import { linkIdOf, readLinkState, type LinkState } from './local-state';
import { scanMirrorDir, type ScannedFile } from './mirror-scan';
import { readRemoteFacts, type RemoteFact } from './remote';
import { planSync, type Plan, type PlanInput } from './sync-plan';

export type Survey = {
  state: LinkState;
  coverage: Coverage;
  scan: ScannedFile[];
  remote: Map<string, RemoteFact>;
  plan: Plan;
};

export async function surveyLink(input: {
  io: CliIo;
  // Its log prints `[sync] …`.
  ctx: VerbContext;
  link: LinkFile;
  host: string;
  stateDir: string;
  coverage?: Coverage;
  scope?: PlanInput['scope'];
}): Promise<Survey> {
  const { io, ctx, link, host } = input;
  const { level } = link.mirror;
  ctx.log(
    `link ${await linkIdOf(link.path)} level ${level} folder ${link.covers.folder ?? '-'} documents ${link.covers.documents.length}`,
  );
  const state = await readLinkState(io, input.stateDir, link.path);
  const coverage = input.coverage ?? (await readCoverage(ctx, link));
  const scan = await scanMirrorDir(io, link, host);
  const scope = input.scope ?? null;
  const trackedIds = scan.flatMap((s) => (s.class === 'tracked' ? [s.file.document.id] : []));
  const wanted = [
    ...new Set([
      ...coverage.documents.map((d) => d.id),
      ...(level === 'files' ? trackedIds : Object.keys(state.documents)),
    ]),
  ].filter((id) => scope === null || scope.documents.has(id));
  const remote = await readRemoteFacts(
    ctx,
    host,
    wanted,
    new Set(level === 'files' ? trackedIds : []),
  );
  const plan = planSync({ level, scan, coverage, remote, recorded: state.documents, scope });
  for (const [id, s] of plan.states) ctx.log(`state ${id} ${s}`);
  return { state, coverage, scan, remote, plan };
}
