// The repository link's verbs (docs/specs/027-repositories/repository-link.md "Commands"; blueprint "The verbs"):
// `link init`, `link status`, `link ls` and `sync`. They read and write the repository's files, so the CLI runs
// them (CLI55); their inputs, outputs and what they print are declared here.

import { z } from 'zod';
import { defineVerb } from '../define';
import { documentListText, listedDocument } from './document';
import { columns, LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT } from './shared';

export const MIRROR_LEVELS = ['none', 'index', 'files'] as const;

// The `Cli·Used` type `sync --watch` counts as, beside `sync`'s own (RL24).
export const SYNC_WATCH_TYPE = 'SyncWatch';

// The order `link status` totals its rows in: the spec's states, then the files a sync refuses or removes, then a
// document whose read failed.
export const STATUS_ORDER = [
  'in-step',
  'behind',
  'ahead',
  'diverged',
  'new',
  'held',
  'local-new',
  'gone',
  'unreadable',
  'gone-changed',
  'lowered',
  'lowered-changed',
  'conflicted',
  'invalid',
  'foreign-host',
  'duplicate',
  '?',
] as const;

const statusRow = z.object({
  state: z.string(),
  ref: z.string().nullable(),
  name: z.string().nullable(),
  path: z.string().nullable(),
});
export type StatusRow = z.infer<typeof statusRow>;

const linkStatusOutput = z.object({
  all: z.boolean(),
  links: z.array(
    z.object({
      path: z.string(),
      rows: z.array(statusRow),
      totals: z.record(z.string(), z.number()),
    }),
  ),
});

const rowCells = (row: StatusRow): string[] => [
  row.state,
  row.ref ?? '-',
  // A file with no readable document keeps its path in the path column.
  row.name === null ? '' : JSON.stringify(row.name),
  ...(row.path === null ? [] : [row.path]),
];

function totalsLine(totals: Record<string, number>): string {
  const shown = STATUS_ORDER.filter((state) => (totals[state] ?? 0) > 0);
  return shown.length === 0 ? '0 documents' : shown.map((s) => `${totals[s]} ${s}`).join(' · ');
}

export const linkInit = defineVerb({
  id: 'link.init',
  summary: 'Write livediagram.toml for this directory',
  description:
    'Writes livediagram.toml in the current directory, linking it to a folder, documents, or both.',
  behaviour: 'write',
  local: true,
  input: z.object({
    folder: z.string().optional().describe('A folder: its id, id prefix or name'),
    doc: z.array(z.string()).optional().describe('A document to link; repeat for more'),
    level: z.enum(MIRROR_LEVELS).optional().describe('What a sync writes; index by default'),
  }),
  output: z.object({ path: z.string() }),
  text: ({ path }) => [path],
  cli: {
    positionals: [],
    examples: [
      'livediagram link init --folder "Minigames" --level files',
      'livediagram link init --doc 3f9c',
    ],
    prints: 'the path written',
  },
});

export const linkStatus = defineVerb({
  id: 'link.status',
  files: true,
  summary: 'Each covered document’s sync state',
  description:
    'Prints every document the link covers with its sync state, and every mirror file a sync would refuse.',
  behaviour: 'read',
  local: true,
  input: z.object({ all: z.boolean().optional().describe('Every link below this directory') }),
  output: linkStatusOutput,
  text: ({ all, links }) =>
    links.flatMap((link, i) => [
      ...(i > 0 ? [''] : []),
      ...(all ? [link.path] : []),
      ...columns(link.rows.map(rowCells)),
      totalsLine(link.totals),
    ]),
  cli: {
    positionals: [],
    examples: ['livediagram link status', 'livediagram link status --all'],
    prints: 'one line per document: state, ref, name, file',
  },
});

export const linkLs = defineVerb({
  id: 'link.ls',
  summary: 'The documents the link covers',
  description: 'Lists the documents the link covers, as document ls lists them.',
  behaviour: 'read',
  local: true,
  input: z.object({
    all: z.boolean().optional().describe('Every link below this directory'),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(LIST_MAX_LIMIT)
      .default(LIST_DEFAULT_LIMIT)
      .describe('At most this many'),
  }),
  output: z.object({ documents: z.array(listedDocument), more: z.number() }),
  listKey: 'documents',
  text: documentListText,
  quiet: ({ documents }) => documents.map((d) => d.ref),
  cli: {
    positionals: [],
    examples: ['livediagram link ls', 'livediagram link ls --json'],
    prints: 'one document a line: ref, name, library, last saved',
  },
});

// `link from-code` (docs/specs/020-import-export/infrastructure-import.md "The CLI"): infrastructure files drawn as
// a tab. The CLI reads the files, so it runs the verb; `--dry-run` needs no host.
export const linkFromCode = defineVerb({
  id: 'link.from-code',
  summary: 'Draw wrangler.toml, Compose, Terraform or Kubernetes files as a tab',
  description:
    "Draws wrangler.toml, Compose, .tf and Kubernetes files (named, else this directory's) as one architecture tab that remembers them: a new document, or a tab on --doc. --update redraws that tab from its files, keeping layout and edits; in a repository link with nothing named, each tab its [[sources]] bind. --dry-run prints the graph as JSON.",
  behaviour: 'write',
  local: true,
  input: z.object({
    files: z.array(z.string()).optional().describe("The files; this directory's by default"),
    doc: z.string().optional().describe('The document for the tab; a new one by default'),
    tab: z.string().optional().describe('The tab --update redraws; the first by default'),
    update: z.boolean().optional().describe('Redraw a tab on --doc from its files'),
    name: z
      .string()
      .min(1)
      .optional()
      .describe('The document or tab name; the drawing’s title by default'),
    env: z
      .string()
      .optional()
      .describe('A wrangler.toml environment to draw in place of the top level'),
    dryRun: z
      .boolean()
      .optional()
      .describe('Write nothing: print the graph, or with --update the counts'),
  }),
  output: z.object({
    text: z.string(),
    id: z.string().nullable(),
    dryRun: z.boolean(),
    graph: z.unknown(),
  }),
  text: ({ text }) => [text],
  json: ({ dryRun, graph, id, text }) => (dryRun ? graph : { id, text }),
  quiet: ({ id }) => (id ? [id] : []),
  cli: {
    positionals: ['...files'],
    examples: [
      'livediagram link from-code',
      'livediagram link from-code --doc "Architecture" --tab Infra --update',
    ],
    prints:
      'the document or tab line; with --update, the counts and changeset; with --dry-run, the graph',
  },
});

// Where `link review` writes its pictures and comment by default (repository-link blueprint RL46).
export const REVIEW_OUT_DIR = 'livediagram-review';

// `link review` (docs/specs/027-repositories/repository-link.md "Pull request review"; blueprint link-review.md):
// before and after pictures of the mirror files a change touched, from git alone, so it needs no host.
export const linkReview = defineVerb({
  id: 'link.review',
  summary: 'Before and after pictures of changed mirror files',
  description:
    'Compares the mirror files changed between the merge base of <base> and <head> (HEAD by default), and writes a before and an after PNG of each changed tab, changed elements outlined, plus comment.md for the pull request. Reads git only: no sign-in.',
  behaviour: 'read',
  local: true,
  offline: true,
  input: z.object({
    base: z.string().min(1).describe('The commit or branch the change is compared with'),
    head: z.string().min(1).default('HEAD').describe('The changed commit; HEAD by default'),
    out: z
      .string()
      .min(1)
      .default(REVIEW_OUT_DIR)
      .describe(`Where to write; ${REVIEW_OUT_DIR} by default`),
    imageUrl: z
      .string()
      .refine((url) => url.includes('{file}'), 'needs {file} where the picture’s name goes')
      .optional()
      .describe('Each picture’s address in the comment, {file} its name'),
  }),
  output: z.object({
    comment: z.string(),
    documents: z.number(),
    tabs: z.number(),
    drawn: z.number(),
    listed: z.number(),
    skipped: z.number(),
    pictures: z.array(z.object({ file: z.string(), width: z.number(), height: z.number() })),
    lines: z.array(z.string()),
  }),
  text: ({ lines }) => lines,
  json: ({ comment, documents, tabs, drawn, listed, skipped, pictures }) => ({
    comment,
    documents,
    tabs,
    drawn,
    listed,
    skipped,
    pictures,
  }),
  quiet: ({ comment }) => [comment],
  cli: {
    positionals: ['base', 'head'],
    examples: [
      'livediagram link review origin/main',
      'livediagram link review main HEAD --out review',
    ],
    prints: 'the comment’s path, then <picture>  <width>×<height> · <n> KB per picture',
  },
});

export const sync = defineVerb({
  id: 'sync',
  files: true,
  summary: 'Mirror the link’s documents into the repository',
  description:
    'Writes the link’s documents into the repository at its mirror level: INDEX.md, and at files a mirror file and an outline file per document. --watch keeps syncing until Ctrl-C.',
  behaviour: 'write',
  local: true,
  input: z.object({
    watch: z.boolean().optional().describe('Keep syncing as the documents and files change'),
    relocate: z.boolean().optional().describe('Move files whose document was renamed or moved'),
    dryRun: z.boolean().optional().describe('Print what a sync would do; write nothing'),
    all: z.boolean().optional().describe('Every link below this directory'),
  }),
  output: z.object({ lines: z.array(z.string()), exit: z.number() }),
  text: ({ lines }) => lines,
  json: ({ lines }) => ({ lines }),
  exitCode: ({ exit }) => exit,
  telemetryType: (input) => (input.watch ? SYNC_WATCH_TYPE : 'Sync'),
  cli: {
    positionals: [],
    examples: ['livediagram sync', 'livediagram sync --watch'],
    prints: 'one line per document acted on, then the totals',
  },
});
