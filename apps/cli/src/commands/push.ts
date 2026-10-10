// `push <file>` (docs/specs/015-api/blueprints/cli.md "Pull and push", CLI28): each tab whose elements changed in a
// pull file goes back as a `replace` changeset based on its pulled revision, strictly, so a tab changed on the server
// since is refused as stale and nothing is overwritten blindly. A tab the document lacks is created. Only elements
// travel: changed settings and a tab gone from the file are named, never applied. The file's revisions and hashes
// follow the tabs that landed.

import {
  submitChangeset,
  VerbRefusal,
  type VerbContext,
  type WriteFlags,
} from '@livediagram/agent-verbs';
import type { ChangesetResponse, DocumentResponse } from '@livediagram/api-schema';
import type { Tab } from '@livediagram/document';
import type { CliIo } from '../io';
import { mirrorFileText } from '../link/mirror-file';
import { CliError, formatError } from '../output/cli-error';
import { EXIT, type ExitCode } from '../output/exit-codes';
import { failureOf } from '../output/failure-of';
import { parsePullFile, pullFileText, tabHashes, type PullFile } from '../sync/pull-file';

export type PushInput = { file: string; dryRun?: boolean; summary?: string; waitHeld?: number };

const quoted = (text: string) => JSON.stringify(text);

async function readPullFile(io: CliIo, path: string): Promise<PullFile> {
  const text = await io.files.read(path);
  if (text === null)
    throw new CliError({ exit: EXIT.usage, code: 'usage', message: `no file ${path}` });
  const parsed = parsePullFile(text);
  if (!parsed.ok)
    throw new CliError({
      exit: EXIT.rejected,
      code: 'invalid_pull_file',
      message: `${path}: ${parsed.message}`,
      hint: 'pull it again: livediagram pull <doc>',
    });
  return parsed.file;
}

type TabPlan = { tab: Tab; create: boolean; hashes: { hash: string; settingsHash: string } };

// What the file asks for, tab by tab; notices for everything that does not travel.
async function planOf(ctx: VerbContext, file: PullFile, onServer: Set<string>): Promise<TabPlan[]> {
  const { tabs: pulled } = file.livediagramSync;
  const plans: TabPlan[] = [];
  for (const tab of file.document.tabs) {
    const hashes = await tabHashes(tab);
    const was = pulled[tab.id];
    const create = !was || !onServer.has(tab.id);
    if (was && hashes.settingsHash !== was.settingsHash)
      ctx.notice(`not pushed: the name, theme or background of tab ${quoted(tab.name)}`);
    if (create || hashes.hash !== was.hash) plans.push({ tab, create, hashes });
  }
  const inFile = new Set(file.document.tabs.map((t) => t.id));
  for (const id of Object.keys(pulled))
    if (!inFile.has(id) && onServer.has(id)) ctx.notice(`not pushed: removing tab ${id}`);
  return plans;
}

export async function pushFile(
  io: CliIo,
  ctx: VerbContext,
  host: string,
  input: PushInput,
): Promise<{ lines: string[]; exit: number }> {
  const file = await readPullFile(io, input.file);
  if (file.livediagramSync.host !== host)
    throw new CliError({
      exit: EXIT.usage,
      code: 'usage',
      message: `${input.file} was pulled from ${file.livediagramSync.host}, not ${host}`,
      hint: `livediagram push ${input.file} --host ${file.livediagramSync.host}`,
    });
  const documentId = file.document.id;
  const { document } = await ctx.api.json<DocumentResponse>(
    `/documents/${encodeURIComponent(documentId)}`,
  );
  const plans = await planOf(ctx, file, new Set(document.tabs.map((t) => t.id)));
  ctx.log(`push ${documentId} ${plans.length} changed tabs`);
  if (plans.length === 0) return { lines: ['nothing to push'], exit: EXIT.done };
  const lines: string[] = [];
  let exit: ExitCode = EXIT.done;
  let landed = false;
  const flags: WriteFlags = {
    ...(input.dryRun ? { dryRun: true } : {}),
    ...(input.summary ? { summary: input.summary } : {}),
    ...(input.waitHeld ? { waitHeld: input.waitHeld } : {}),
  };
  for (const { tab, create, hashes } of plans) {
    const target = { documentId, tabId: tab.id, tabName: tab.name, doc: documentId };
    let response: ChangesetResponse;
    try {
      response = await submitChangeset(
        ctx,
        target,
        {
          replace: create ? { elements: tab.elements, name: tab.name } : { elements: tab.elements },
        },
        create
          ? { ...flags, base: null }
          : { ...flags, base: file.livediagramSync.tabs[tab.id]!.rev, strict: true },
      );
    } catch (err) {
      if (err instanceof VerbRefusal && err.code === 'stale_tab') {
        lines.push(`! stale tab ${quoted(tab.name)}: changed on the host since the pull`);
        exit = EXIT.conflict;
        continue;
      }
      const failure = failureOf(err, host);
      io.stderr(formatError(failure, false));
      if (exit !== EXIT.conflict && failure.exit > exit) exit = failure.exit;
      continue;
    }
    lines.push(`tab ${quoted(tab.name)}`, ...response.text.split('\n'));
    if (input.dryRun) continue;
    // "Nothing changed" writes no revision: the tab keeps the one it was pulled at. The settings stay as pulled,
    // since they were not sent: a rename keeps being named until the file is pulled again.
    const pulled = file.livediagramSync.tabs[tab.id];
    file.livediagramSync.tabs[tab.id] = {
      rev: response.changeset?.rev ?? pulled!.rev,
      hash: hashes.hash,
      settingsHash: pulled?.settingsHash ?? hashes.settingsHash,
    };
    landed = true;
  }
  // A mirror file (no `pulledAt`) is written back in its own canonical form, byte-stable for git (RL30, RL31).
  const text =
    file.livediagramSync.pulledAt === undefined ? mirrorFileText(file) : pullFileText(file);
  if (landed) await io.files.write(input.file, text);
  return { lines, exit };
}
