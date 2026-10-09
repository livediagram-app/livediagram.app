// One sync pass (docs/specs/027-repositories/blueprints/repository-link.md "One sync pass"): the lock, the local
// sync state, coverage, the scan, the api's answers, the plan, then the acts in their order (relocations, writes,
// removals), INDEX.md and the report. A failure of one document never stops the others; a failure of the lock, the
// coverage read or the credential stops the pass before anything is written. `--dry-run` takes no lock and writes
// nothing, the local sync state included (RL13).

import { posix } from 'node:path';
import type { VerbContext } from '@livediagram/agent-verbs';
import { ApiError } from '@livediagram/api-client';
import { DOCUMENT_ENVELOPE_KIND, DOCUMENT_SCHEMA_VERSION } from '@livediagram/document';
import { readDocumentSnapshot } from '../commands/snapshot';
import type { CliIo } from '../io';
import { EXIT, type ExitCode } from '../output/exit-codes';
import { failureOf } from '../output/failure-of';
import { INDEX_FILE_NAME } from './constants';
import type { Coverage } from './coverage';
import { indexEntriesOf, type MirrorHeld } from './index-entries';
import { indexFileText } from './index-file';
import type { LinkFile } from './link-file';
import { acquireLinkLock } from './lock';
import { linkStateDir, saveReport, writeLinkState, type LinkState } from './local-state';
import { mirrorFileText, type MirrorFile } from './mirror-file';
import { outlinePathOf } from './mirror-paths';
import type { ScannedFile } from './mirror-scan';
import { GENERATED_LINE_START, mirrorTree, type MirrorTree } from './mirror-tree';
import { outlineFileText } from './outline-file';
import { remoteTabsOf, type RemoteFact } from './remote';
import { actionLine, totalsLine, type Totals } from './sync-lines';
import type { PlanInput, SyncAction } from './sync-plan';
import { surveyLink } from './sync-survey';

export type PassOptions = {
  io: CliIo;
  // Its log prints `[sync] …`.
  ctx: VerbContext;
  link: LinkFile;
  // The link's host, or the profile's.
  host: string;
  dryRun: boolean;
  relocate: boolean;
  command: string;
  // A pass narrowed by `--watch`: the coverage it holds, and the documents and files to act on.
  coverage?: Coverage;
  scope?: PlanInput['scope'];
};

export type PassResult = {
  lines: string[];
  exit: ExitCode;
  coverage: Coverage;
  // Each absolute path written (the SHA-256 of its bytes) or removed (null), for `--watch` (RL23).
  touched: Map<string, string | null>;
  // Each mirror file's path (relative to the mirror directory) and the document it holds.
  mirrors: Map<string, string>;
};

const exitOf = (action: SyncAction): ExitCode =>
  action.kind === 'transient'
    ? action.exit
    : action.kind === 'refuse' || action.kind === 'held'
      ? EXIT.rejected
      : EXIT.done;

const revsOf = (pulled: MirrorFile['livediagramSync']['tabs']) =>
  Object.fromEntries(Object.entries(pulled).map(([id, t]) => [id, t.rev]));

const outlineOf = (file: MirrorFile) =>
  outlineFileText(
    file.document,
    file.document.tabs.map((tab) => ({ tab, rev: file.livediagramSync.tabs[tab.id]!.rev })),
    file.livediagramSync.host,
  );

export async function runSyncPass(options: PassOptions): Promise<PassResult> {
  const { io, ctx, link, dryRun } = options;
  const stateDir = await linkStateDir(io, link);
  const lock = dryRun
    ? null
    : await acquireLinkLock(io, stateDir, link.path, options.command, ctx.log);
  try {
    return await pass(options, stateDir);
  } finally {
    await lock?.release();
  }
}

// What the pass acts with: the tree, the state it records, and what each document's file holds afterwards.
type Acting = {
  options: PassOptions;
  tree: MirrorTree;
  state: LinkState;
  scan: readonly ScannedFile[];
  remote: ReadonlyMap<string, RemoteFact>;
  mirrors: Map<string, MirrorHeld>;
  // Where a relocation moved a document's files.
  moved: Map<string, string>;
  // A path relative to the mirror directory, as the working directory reaches it.
  pathOf: (rel: string) => string;
  now: number;
};

const record = (acting: Acting, id: string, name: string, revs: Record<string, number>) => {
  acting.state.documents[id] = {
    name,
    tabs: Object.fromEntries(
      Object.entries(revs).map(([t, rev]) => [t, { rev, syncedAt: acting.now }]),
    ),
  };
};

async function relocateAct(
  acting: Acting,
  action: Extract<SyncAction, { kind: 'relocate' }>,
): Promise<SyncAction> {
  const { ctx } = acting.options;
  try {
    const how = await acting.tree.move(action.path, action.to);
    ctx.log(`relocate ${action.documentId} moved ${how}`);
    acting.moved.set(action.documentId, action.to);
    return action;
  } catch (err) {
    // Neither git nor a rename could move it (E17): nothing else moves for that document.
    ctx.log(`relocate ${action.documentId} failed`);
    return {
      kind: 'transient',
      documentId: action.documentId,
      name: action.name,
      failure: `could not move ${acting.pathOf(action.path)} to ${acting.pathOf(action.to)} (${(err as Error).message})`,
      exit: EXIT.failure,
      reason: 'move',
    };
  }
}

async function writeAct(
  acting: Acting,
  action: Extract<SyncAction, { kind: 'write' }>,
): Promise<SyncAction> {
  const { ctx, host, link } = acting.options;
  if (link.mirror.level !== 'files') {
    record(
      acting,
      action.documentId,
      action.name,
      Object.fromEntries(action.tabs.map((t) => [t.id, t.to])),
    );
    return action;
  }
  let file: MirrorFile;
  try {
    const snapshot = await readDocumentSnapshot(ctx, action.documentId);
    file = {
      kind: DOCUMENT_ENVELOPE_KIND,
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      document: { ...snapshot.document, tabs: snapshot.tabs },
      livediagramSync: { host, tabs: snapshot.pulled },
    };
  } catch (err) {
    const failure = failureOf(err, host);
    if (failure.exit === EXIT.auth) throw err;
    ctx.log(`transient ${action.documentId} ${err instanceof ApiError ? err.status : 'network'}`);
    return {
      kind: 'transient',
      documentId: action.documentId,
      name: action.name,
      failure: failure.message,
      exit: failure.exit === EXIT.rateLimited ? EXIT.rateLimited : EXIT.failure,
      reason: failure.code,
    };
  }
  const path = acting.moved.get(action.documentId) ?? action.path!;
  await acting.tree.write(path, mirrorFileText(file));
  if (!(await acting.tree.writeGenerated(outlinePathOf(path), outlineOf(file))))
    ctx.log(`kept ${outlinePathOf(path)}: not generated`);
  const revs = revsOf(file.livediagramSync.tabs);
  for (const tab of file.document.tabs)
    ctx.log(`wrote ${action.documentId} ${tab.id} rev ${revs[tab.id]}`);
  acting.mirrors.set(action.documentId, { path, tabs: file.document.tabs, revs });
  record(acting, action.documentId, file.document.name, revs);
  // The line names the revisions the reads found (E14).
  const before = new Map(action.tabs.map((t) => [t.id, t.from]));
  return {
    ...action,
    name: file.document.name,
    path,
    tabs: file.document.tabs.map((t) => ({
      id: t.id,
      name: t.name,
      from: before.get(t.id) ?? null,
      to: revs[t.id]!,
    })),
  };
}

async function inStepAct(acting: Acting, action: Extract<SyncAction, { kind: 'none' }>) {
  const tracked = acting.scan.find(
    (s): s is Extract<ScannedFile, { class: 'tracked' }> =>
      s.class === 'tracked' && s.file.document.id === action.documentId,
  );
  if (acting.options.link.mirror.level === 'files' && tracked) {
    const path = acting.moved.get(action.documentId) ?? tracked.path;
    // Rewritten only when missing, so CLIs of different versions never rewrite each other's outlines (RL12).
    if ((await acting.tree.read(outlinePathOf(path))) === null)
      await acting.tree.writeGenerated(outlinePathOf(path), outlineOf(tracked.file));
    const revs = revsOf(tracked.file.livediagramSync.tabs);
    acting.mirrors.set(action.documentId, { path, tabs: tracked.file.document.tabs, revs });
    record(acting, action.documentId, action.name, revs);
    return;
  }
  const fact = acting.remote.get(action.documentId) as Extract<RemoteFact, { kind: 'readable' }>;
  record(
    acting,
    action.documentId,
    action.name,
    Object.fromEntries(remoteTabsOf(fact.overview).map((t) => [t.tab.id, t.rev!])),
  );
}

async function removeAct(
  acting: Acting,
  action: Extract<SyncAction, { kind: 'remove' | 'lower' }>,
) {
  const { ctx } = acting.options;
  ctx.log(
    action.kind === 'remove'
      ? `gone ${action.documentId} ${action.reason}`
      : `lowered ${action.documentId}`,
  );
  if (action.path) {
    await acting.tree.remove(action.path, false);
    await acting.tree.remove(outlinePathOf(action.path), true);
  }
  if (action.kind === 'remove') delete acting.state.documents[action.documentId];
}

// The acts in their order, each action's outcome in its place: relocations, then writes, then removals.
async function act(acting: Acting, actions: readonly SyncAction[]): Promise<SyncAction[]> {
  const outcome = [...actions];
  const { relocate } = acting.options;
  for (const [i, a] of actions.entries())
    if (a.kind === 'relocate') {
      if (relocate) outcome[i] = await relocateAct(acting, a);
      else acting.options.ctx.log(`relocate ${a.documentId} pending`);
    }
  // A document whose files could not move writes nothing either.
  const stuck = new Set(outcome.flatMap((a) => (a.kind === 'transient' ? [a.documentId] : [])));
  for (const [i, a] of actions.entries()) {
    if (a.kind === 'write' && !stuck.has(a.documentId)) outcome[i] = await writeAct(acting, a);
    if (a.kind === 'none') await inStepAct(acting, a);
  }
  for (const a of actions)
    if (a.kind === 'remove' || a.kind === 'lower') await removeAct(acting, a);
  return outcome;
}

function linesOf(
  actions: readonly SyncAction[],
  options: PassOptions,
  pathOf: (rel: string) => string,
) {
  const lc = {
    pathOf,
    level: options.link.mirror.level,
    relocate: options.relocate,
    linkHost: options.host,
  };
  const totals: Totals = { inStep: 0, written: 0, removed: 0, refused: 0, unreadable: 0 };
  const lines: string[] = [];
  for (const action of actions) {
    const line = actionLine(action, lc);
    if (line !== null) lines.push(line);
    if (action.kind === 'none') totals.inStep += 1;
    if (action.kind === 'write') totals.written += 1;
    if (action.kind === 'remove' || action.kind === 'lower') totals.removed += 1;
    if (action.kind === 'refuse' || action.kind === 'held') totals.refused += 1;
    if (action.kind === 'report' && action.reason === 'unreadable') totals.unreadable += 1;
    if (action.kind === 'refuse')
      options.ctx.log(`refused ${action.documentId ?? '-'} ${action.reason}`);
    if (action.kind === 'held') options.ctx.log(`refused ${action.documentId} held`);
    if (action.kind === 'report' && action.reason === 'local-new') options.ctx.log('local-new');
  }
  return { lines, totals };
}

// A dry run's actions as a real pass would report them: with --relocate, a document writes at the path it moves to.
function dryRunOf(actions: readonly SyncAction[], relocate: boolean): SyncAction[] {
  const to = new Map(
    actions.flatMap((a) =>
      relocate && a.kind === 'relocate' ? [[a.documentId, a.to] as const] : [],
    ),
  );
  return actions.map((a) =>
    a.kind === 'write' && to.has(a.documentId) ? { ...a, path: to.get(a.documentId)! } : a,
  );
}

// The path each written or in-step document's mirror file would hold after a dry run's pass.
function plannedPaths(
  actions: readonly SyncAction[],
  scan: readonly ScannedFile[],
  relocate: boolean,
): Map<string, string> {
  const planned = new Map<string, string>();
  for (const a of actions) {
    if (a.kind === 'write') planned.set(a.documentId, a.path!);
    if (a.kind === 'relocate' && relocate) planned.set(a.documentId, a.to);
  }
  for (const a of actions)
    if (a.kind === 'none' && !planned.has(a.documentId)) {
      const file = scan.find((s) => s.class === 'tracked' && s.file.document.id === a.documentId)!;
      planned.set(a.documentId, file.path);
    }
  return planned;
}

async function pass(options: PassOptions, stateDir: string): Promise<PassResult> {
  const { io, ctx, link, host, dryRun } = options;
  const started = io.now();
  const { level } = link.mirror;
  const tree = mirrorTree(io, link);
  const pathOf = (rel: string) => posix.relative(io.cwd, tree.abs(rel));
  const { state, coverage, scan, remote, plan } = await surveyLink({ ...options, stateDir });

  const acting: Acting = {
    options,
    tree,
    state,
    scan,
    remote,
    mirrors: new Map(),
    moved: new Map(),
    pathOf,
    now: io.now(),
  };
  const outcome = dryRun
    ? dryRunOf(plan.actions, options.relocate)
    : await act(acting, plan.actions);
  const { lines, totals } = linesOf(outcome, options, pathOf);
  const exit = Math.max(EXIT.done, ...outcome.map(exitOf)) as ExitCode;

  // INDEX.md: at `index` and `files` rewritten when its bytes differ; at `none` a generated one is removed (RL42).
  const previous = await tree.read(INDEX_FILE_NAME);
  if (level === 'none') {
    if (previous?.startsWith(GENERATED_LINE_START)) {
      lines.push(`- ${pathOf(INDEX_FILE_NAME)}`);
      if (!dryRun) await tree.remove(INDEX_FILE_NAME, true);
    }
  } else {
    // A written document's state outlives a failed read only as the failure: its previous section stays.
    const states = new Map(plan.states);
    for (const a of outcome) if (a.kind === 'transient') states.set(a.documentId, 'transient');
    const text = indexFileText({
      linkFile: posix.relative(tree.abs('.'), link.path),
      host,
      level,
      previous,
      entries: indexEntriesOf({
        level,
        coverage,
        states,
        remote,
        mirrors: acting.mirrors,
        planned:
          dryRun && level === 'files' ? plannedPaths(outcome, scan, options.relocate) : new Map(),
        names: new Map(plan.names),
      }),
    });
    // An INDEX.md a person wrote is theirs: never rewritten (writeGenerated), and not reported as changed.
    const ours = previous === null || previous.startsWith(GENERATED_LINE_START);
    if (!ours) ctx.log(`kept ${INDEX_FILE_NAME}: not generated`);
    else if (text !== previous) {
      lines.push(`~ ${pathOf(INDEX_FILE_NAME)}`);
      if (!dryRun) await tree.writeGenerated(INDEX_FILE_NAME, text);
    }
  }
  lines.push(totalsLine(totals));
  if (dryRun) lines.push('dry run: nothing written');
  else {
    await writeLinkState(io, stateDir, state);
    await saveReport(io, stateDir, {
      startedAt: started,
      finishedAt: io.now(),
      command: options.command,
      lines,
      exit,
    });
  }
  ctx.log(`pass ${plan.actions.length} actions exit ${exit} ${io.now() - started} ms`);
  const mirrors = new Map([...acting.mirrors].map(([id, held]) => [held.path, id]));
  return { lines, exit, coverage, touched: tree.touched, mirrors };
}
