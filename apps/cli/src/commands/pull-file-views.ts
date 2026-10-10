// A pull file read as a document, offline and read-only (docs/specs/015-api/blueprints/cli.md "Addressing", CLI70):
// `document view`, `tab ls` and `tab view` render it with the views the api renders, with each tab's pulled revision;
// any other verb given one exits 2. No host, profile or credential is read.

import { resolveTab, tabListOf, type Verb } from '@livediagram/agent-verbs';
import { ApiError } from '@livediagram/api-client';
import { headerFactsOf, overviewView, renderView } from '@livediagram/document-views';
import { INVALID_VIEW_VALUE_ERROR, TAB_VIEW_NAMES, VIEW_REQUIRED } from '@livediagram/api-schema';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import { parsePullFile, PULL_FILE_SUFFIX, type PullFile } from '../sync/pull-file';

const READABLE = ['document.view', 'tab.ls', 'tab.view'];

export type ViewInput = {
  doc: string;
  tab?: string;
  // Defaulted to the outline by the verb's input.
  view: (typeof TAB_VIEW_NAMES)[number];
  ref?: string;
  text?: string;
  budget?: number;
  only?: string;
  coarse?: boolean;
  style?: boolean;
  all?: boolean;
  json?: boolean;
  raw?: boolean;
};

// The pull file a verb's `<doc>` names, or null when it names none (a name, a prefix, a link).
export async function pullFileOf(
  io: CliIo,
  input: Record<string, unknown>,
): Promise<{ path: string; file: PullFile } | null> {
  const doc = input.doc;
  if (typeof doc !== 'string' || !doc.endsWith(PULL_FILE_SUFFIX)) return null;
  const text = await io.files.read(doc);
  if (text === null) return null;
  const parsed = parsePullFile(text);
  if (!parsed.ok)
    throw new CliError({
      exit: EXIT.rejected,
      code: 'invalid_pull_file',
      message: `${doc}: ${parsed.message}`,
    });
  return { path: doc, file: parsed.file };
}

const tabIdsOf = (file: PullFile) => file.document.tabs.map((t) => t.id);

// When the file's document was last saved: its pull, or for a mirror file, which holds no time, its newest tab
// (RL10).
function savedAtOf(file: PullFile): number {
  if (file.livediagramSync.pulledAt !== undefined) return file.livediagramSync.pulledAt;
  const updated = file.document.tabs.map((t) => Reflect.get(t, 'updatedAt'));
  return Math.max(0, ...updated.filter((at): at is number => typeof at === 'number'));
}
const summariesOf = (file: PullFile) =>
  file.document.tabs.map((t, orderIndex) => ({ id: t.id, name: t.name, orderIndex }));

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
      message: `${path} is a pull file: only document view, tab ls and tab view read it`,
      hint: `name the document instead of the file: ${file.document.id}`,
    });
  log(`address document file ${path}`);
  const { document, livediagramSync: sync } = file;
  if (verb.id === 'tab.ls') return { tabs: tabListOf(summariesOf(file)) };
  const tabIds = tabIdsOf(file);
  if (verb.id === 'document.view') {
    const tabs = document.tabs.map((tab) => ({
      id: tab.id,
      outOfScope: false as const,
      facts: headerFactsOf(tab, { rev: sync.tabs[tab.id]?.rev, tabIds }),
    }));
    const result = overviewView(
      { id: document.id, name: document.name, savedAt: savedAtOf(file) },
      tabs,
      {
        now,
        door: 'cli',
      },
    );
    return { text: result.text };
  }
  const summary = resolveTab(summariesOf(file), input.tab, input.doc, log);
  const tab = document.tabs.find((t) => t.id === summary.id)!;
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
      ...(input.coarse ? { coarse: true } : {}),
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
