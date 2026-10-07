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
