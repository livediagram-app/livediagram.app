// The verbs the CLI handles itself (docs/specs/015-api/blueprints/cli.md CLI55): declared here so help and
// routing come from one catalogue; their handlers need Node and live in apps/cli.

import { z } from 'zod';
import { GUIDE_TOPIC_NAMES } from '../guides';
import { defineVerb } from '../define';
import { writeFlags } from '../write';
import { columns } from './shared';

export const guide = defineVerb({
  id: 'guide',
  offline: true,
  summary: 'How-tos: build, edit, views, comments, collaborate',
  description: 'Prints the list of guide topics, or one topic.',
  behaviour: 'read',
  local: true,
  input: z.object({
    topic: z
      .enum(GUIDE_TOPIC_NAMES as [string, ...string[]])
      .optional()
      .describe('A topic'),
  }),
  output: z.object({ text: z.string() }),
  text: ({ text }) => [text],
  cli: {
    positionals: ['topic'],
    examples: ['livediagram guide', 'livediagram guide edit'],
    prints: 'the topics, or one topic',
  },
});

export const skillPrint = defineVerb({
  id: 'skill.print',
  offline: true,
  summary: 'Print the agent skill file',
  description: 'Prints SKILL.md, the agent skill that says when and how to use this CLI.',
  behaviour: 'read',
  local: true,
  input: z.object({}),
  output: z.object({ text: z.string() }),
  text: ({ text }) => [text],
  cli: {
    positionals: [],
    examples: ['livediagram skill print', 'livediagram skill print > SKILL.md'],
    prints: 'the SKILL.md file',
  },
});

export const skillInstall = defineVerb({
  id: 'skill.install',
  offline: true,
  summary: "Write the skill into an agent's skills directory",
  description: 'Writes <dir>/livediagram/SKILL.md, overwriting only a livediagram skill.',
  behaviour: 'write',
  local: true,
  input: z.object({ to: z.string().optional().describe('The skills directory of your agent') }),
  output: z.object({ path: z.string() }),
  text: ({ path }) => [path],
  cli: {
    positionals: [],
    examples: [
      'livediagram skill install --to ~/.claude/skills',
      'livediagram skill install --to ./.agents/skills',
    ],
    prints: 'the path written',
  },
});

export const apiCall = defineVerb({
  id: 'api',
  summary: 'Any api route, authenticated: the escape hatch',
  description:
    'Sends one request to an api path on the active host with the credential, and prints the body as sent.',
  behaviour: 'write',
  local: true,
  input: z.object({
    method: z.string().describe('GET, POST, PUT, PATCH or DELETE'),
    path: z.string().describe('A path under /api, such as /documents'),
    body: z.string().optional().describe('A file with the request body, or - for stdin'),
  }),
  output: z.object({ text: z.string(), status: z.number() }),
  text: ({ text }) => [text],
  cli: {
    positionals: ['method', 'path'],
    examples: ['livediagram api GET /documents', 'livediagram api POST /documents --body doc.json'],
    prints: 'the response body',
  },
});

export const authLogin = defineVerb({
  id: 'auth.login',
  summary: 'Sign in: a token from stdin',
  description:
    'Stores an lvd_ API token for this profile, read from stdin with --with-token, after checking it with the api.',
  behaviour: 'write',
  local: true,
  input: z.object({ withToken: z.boolean().optional().describe('Read the token from stdin') }),
  output: z.object({ host: z.string(), account: z.string() }),
  text: ({ host, account }) => [`signed in to ${host} as ${account}`],
  cli: {
    positionals: [],
    examples: [
      'printf %s "$TOKEN" | livediagram auth login --with-token',
      'livediagram auth login --with-token < token.txt',
    ],
    prints: 'the host and account signed in to',
  },
});

export const authStatus = defineVerb({
  id: 'auth.status',
  summary: 'Who is signed in, where, and until when',
  description:
    'Prints the host, account, token name, its role and expiry, and where the credential comes from; never the secret.',
  behaviour: 'read',
  local: true,
  input: z.object({}),
  output: z.object({
    host: z.string(),
    account: z.string(),
    token: z.string(),
    role: z.string(),
    expires: z.string(),
    source: z.string(),
  }),
  text: (s) =>
    columns([
      ['host', s.host],
      ['account', s.account],
      ['token', s.token],
      ['role', s.role],
      ['expires', s.expires],
      ['source', s.source],
    ]),
  cli: {
    positionals: [],
    examples: ['livediagram auth status', 'livediagram auth status --json'],
    prints: 'host, account, token, role, expires, source',
  },
});

export const authLogout = defineVerb({
  id: 'auth.logout',
  summary: 'Revoke the stored token and forget it',
  description:
    "Revokes the stored token with the api, then forgets it. A token from LIVEDIAGRAM_TOKEN is not the CLI's to revoke.",
  behaviour: 'destructive',
  local: true,
  input: z.object({}),
  output: z.object({ host: z.string() }),
  text: ({ host }) => [`signed out of ${host}`],
  cli: {
    positionals: [],
    examples: ['livediagram auth logout', 'livediagram --profile work auth logout'],
    prints: 'the host signed out of',
  },
});

const telemetryVerb = (on: boolean) =>
  defineVerb({
    id: on ? 'telemetry.on' : 'telemetry.off',
    summary: on ? 'Count which commands succeed again' : 'Stop counting which commands succeed',
    description: on
      ? 'Turns the usage count back on for this machine: the name of each command that succeeds, sent to the active host.'
      : 'Turns the usage count off for this machine, after telling the host it was turned off.',
    behaviour: 'write',
    local: true,
    input: z.object({}),
    output: z.object({ telemetry: z.enum(['on', 'off']) }),
    text: ({ telemetry }) => [`telemetry ${telemetry}`],
    cli: {
      positionals: [],
      examples: [
        `livediagram telemetry ${on ? 'on' : 'off'}`,
        `LIVEDIAGRAM_TELEMETRY=0 livediagram document ls`,
      ],
      prints: `telemetry ${on ? 'on' : 'off'}`,
    },
  });

export const telemetryOn = telemetryVerb(true);
export const telemetryOff = telemetryVerb(false);

// The room stream's verbs (blueprint "The room stream"): they hold a socket and a clock, so the CLI runs them.
const streamOutput = z.object({ lines: z.array(z.string()), exit: z.number() });

export const waitFor = defineVerb({
  id: 'wait',
  summary: 'Block until a comment or a change arrives, then print it',
  description:
    'Listens on the document\u2019s room until a comment is added, or until something changes and settles (a burst of edits is one change); prints it and exits 0. --timeout exits 0 with a line saying nothing came; Ctrl-C exits 1.',
  behaviour: 'read',
  local: true,
  input: z.object({
    doc: z.string().describe('A name, id prefix or livediagram URL'),
    for: z.enum(['comment', 'change']).describe('What to wait for: a comment, or a change'),
    tab: z.string().optional().describe('A tab name or id prefix; every tab when omitted'),
    timeout: z.coerce.number().positive().optional().describe('Seconds to wait at most'),
  }),
  output: streamOutput,
  text: ({ lines }) => lines,
  json: ({ lines }) => ({ lines }),
  exitCode: ({ exit }) => exit,
  cli: {
    positionals: ['doc'],
    examples: [
      'livediagram wait "Shop" --for comment',
      'livediagram wait 3f9c --for change --timeout 600',
    ],
    prints: 'the comment\u2019s thread, the change, or that nothing came',
  },
});

export const watch = defineVerb({
  id: 'watch',
  summary: 'Stream comments and changes as they happen',
  description:
    'Listens on the document\u2019s room and prints a line for each changeset, element change, comment and tab or document change, until Ctrl-C (exit 0).',
  behaviour: 'read',
  local: true,
  input: z.object({
    doc: z.string().describe('A name, id prefix or livediagram URL'),
    tab: z.string().optional().describe('A tab name or id prefix; every tab when omitted'),
  }),
  output: streamOutput,
  text: ({ lines }) => lines,
  exitCode: ({ exit }) => exit,
  cli: {
    positionals: ['doc'],
    examples: ['livediagram watch "Shop"', 'livediagram watch 3f9c --tab Flow --json'],
    prints: 'one line per event; --json one object a line',
  },
  // Each event went out as it came; nothing is left to print at the end.
  json: () => undefined,
});

// One document to a file and back (blueprint "Pull and push"): they read and write files, so the CLI runs them.
export const pull = defineVerb({
  id: 'pull',
  files: true,
  summary: 'Write a document to a file, to edit and push back',
  description:
    'Writes <slug>.livediagram.json: the document, every tab and each tab\u2019s revision, in the format the editor imports. --svg adds a drawing per tab. Prints the paths written.',
  behaviour: 'read',
  local: true,
  input: z.object({
    doc: z.string().describe('A name, id prefix or livediagram URL'),
    to: z.string().optional().describe('The directory to write to; the current one by default'),
    svg: z.boolean().optional().describe('Also write each tab as an SVG drawing'),
  }),
  output: z.object({ paths: z.array(z.string()) }),
  text: ({ paths }) => paths,
  quiet: ({ paths }) => paths,
  cli: {
    positionals: ['doc'],
    examples: ['livediagram pull "Shop"', 'livediagram pull 3f9c --to docs --svg'],
    prints: 'the paths written',
  },
});

export const push = defineVerb({
  id: 'push',
  files: true,
  summary: 'Send the tabs changed in a pull file back',
  description:
    'Sends each tab whose elements changed in a pull file as a changeset based on its pulled revision; a tab changed on the server since is refused as stale and named. Only elements travel: a changed name, theme or background, and a tab gone from the file, are named as not pushed. Updates the file\u2019s revisions for the tabs that landed.',
  behaviour: 'write',
  local: true,
  input: z.object({
    file: z.string().describe('A file written by livediagram pull'),
    dryRun: writeFlags.dryRun,
    summary: writeFlags.summary,
    waitHeld: writeFlags.waitHeld,
  }),
  output: z.object({ lines: z.array(z.string()), exit: z.number() }),
  text: ({ lines }) => lines,
  json: ({ lines }) => ({ lines }),
  exitCode: ({ exit }) => exit,
  cli: {
    positionals: ['file'],
    examples: [
      'livediagram push shop.livediagram.json',
      'livediagram push shop.livediagram.json --dry-run',
    ],
    prints: 'each changed tab\u2019s result lines, or ! stale <tab>',
  },
});

// Every document to files, read-only, for backups and docs (blueprint "Pull and push", CLI29).
export const EXPORT_FORMATS = ['json', 'svg', 'mermaid', 'md'] as const;

export const exportAll = defineVerb({
  id: 'export',
  files: true,
  summary: 'Every document to files, for backups and docs',
  description:
    'Writes every document the token can read: <slug>.livediagram.json (json, the default), and per tab <slug>/<tab-slug>.svg, .mmd or .md. Prints the paths written, then the totals.',
  behaviour: 'read',
  local: true,
  input: z.object({
    all: z.boolean().optional().describe('Every document; required'),
    to: z.string().describe('The directory to write to'),
    format: z
      .string()
      .default('json')
      .describe(`A comma-separated list of ${EXPORT_FORMATS.join(', ')}`),
  }),
  output: z.object({ paths: z.array(z.string()), documents: z.number(), exit: z.number() }),
  text: ({ paths, documents }) => [
    ...paths,
    `${documents} document${documents === 1 ? '' : 's'} · ${paths.length} file${paths.length === 1 ? '' : 's'}`,
  ],
  quiet: ({ paths }) => paths,
  exitCode: ({ exit }) => exit,
  cli: {
    positionals: [],
    examples: [
      'livediagram export --all --to backup',
      'livediagram export --all --to docs --format svg,md',
    ],
    prints: 'the paths written, then <n> documents · <m> files',
  },
});
