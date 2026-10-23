// A pull file read as a project, offline and read-only (docs/specs/015-api/blueprints/cli.md "Addressing", CLI70):
// `project view`, `tab ls` and `tab view` render it with the views the api renders, with each tab's pulled revision;
// any other verb given one exits 2. No host, profile or credential is read.

import { resolveTab, tabListOf, type Verb } from '@liveplanner/agent-verbs';
import { ApiError } from '@liveplanner/api-client';
import { headerFactsOf, overviewView, renderView } from '@liveplanner/project-views';
import { INVALID_VIEW_VALUE_ERROR, TAB_VIEW_NAMES, VIEW_REQUIRED } from '@liveplanner/api-schema';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import { parsePullFile, PULL_FILE_SUFFIX, type PullFile } from '../sync/pull-file';

const READABLE = ['project.view', 'tab.ls', 'tab.view'];

export type ViewInput = {
  project: string;
  tab?: string;
  // Defaulted to the outline by the verb's input.
  view: (typeof TAB_VIEW_NAMES)[number];
  ref?: string;
  text?: string;
  budget?: number;
  only?: string;
  style?: boolean;
  all?: boolean;
  json?: boolean;
  raw?: boolean;
};

// The pull file a verb's `<project>` names, or null when it names none (a name, a prefix, a link).
export async function pullFileOf(
  io: CliIo,
  input: Record<string, unknown>,
): Promise<{ path: string; file: PullFile } | null> {
  const ref = input.project;
  if (typeof ref !== 'string' || !ref.endsWith(PULL_FILE_SUFFIX)) return null;
  const text = await io.files.read(ref);
  if (text === null) return null;
  const parsed = parsePullFile(text);
  if (!parsed.ok)
    throw new CliError({
      exit: EXIT.rejected,
      code: 'invalid_pull_file',
      message: `${ref}: ${parsed.message}`,
    });
  return { path: ref, file: parsed.file };
}

const tabIdsOf = (file: PullFile) => file.project.tabs.map((t) => t.id);

const summariesOf = (file: PullFile) =>
  file.project.tabs.map((t, orderIndex) => ({ id: t.id, name: t.name, orderIndex }));

export function pullFileView(
  verb: Verb,
  input: ViewInput,
  { path, file }: { path: string; file: PullFile },
  now: number,
  log: (line: string) => void,
): unknown {
  if (!READABLE.includes(verb.id))
    throw new CliError({
      exit: EXIT.usage,
      code: 'usage',
      message: `${path} is a pull file: only project view, tab ls and tab view read it`,
      hint: `name the plan instead of the file: ${file.project.id}`,
    });
  log(`address project file ${path}`);
  const { project, liveplannerSync: sync } = file;
  if (verb.id === 'tab.ls') return { tabs: tabListOf(summariesOf(file)) };
  const tabIds = tabIdsOf(file);
  if (verb.id === 'project.view') {
    const tabs = project.tabs.map((tab) => ({
      id: tab.id,
      outOfScope: false as const,
      facts: headerFactsOf(tab, { rev: sync.tabs[tab.id]?.rev, tabIds }),
    }));
    const result = overviewView(
      { id: project.id, name: project.name, savedAt: sync.pulledAt },
      tabs,
      {
        now,
        door: 'cli',
      },
    );
    return { text: result.text };
  }
  const summary = resolveTab(summariesOf(file), input.tab, input.project, log);
  const tab = project.tabs.find((t) => t.id === summary.id)!;
  if (input.raw) return { json: tab };
  const { view } = input;
  // The api refuses a view without the value it needs before it renders; so does this.
  const required = VIEW_REQUIRED[view];
  if (required !== undefined && (required === 'ref' ? input.ref : input.text) === undefined)
    throw new ApiError(
      400,
      JSON.stringify({
        error: INVALID_VIEW_VALUE_ERROR,
        message: `view ${view} needs ${required}`,
      }),
    );
  const rendered = renderView(
    {
      view,
      door: 'cli',
      ...(input.budget === undefined ? {} : { budget: input.budget }),
      ...(input.only === undefined ? {} : { only: input.only }),
      ...(input.ref === undefined ? {} : { ref: input.ref }),
      ...(input.text === undefined ? {} : { q: input.text }),
      ...(input.style ? { style: true } : {}),
      ...(input.all ? { all: true } : {}),
    },
    tab,
    { rev: sync.tabs[tab.id]?.rev, tabIds },
  );
  // A refusal reads as the api's would: the same codes, the same wording.
  if (!rendered.ok) {
    const status = rendered.refusal.error === 'invalid_value' ? 400 : 404;
    throw new ApiError(status, JSON.stringify(rendered.refusal));
  }
  return input.json ? { json: rendered.json } : { text: rendered.text };
}
