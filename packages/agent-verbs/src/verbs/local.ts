// The verbs the CLI handles itself (docs/specs/015-api/blueprints/cli.md CLI55): declared here so help and
// routing come from one catalogue; their handlers need Node and live in apps/cli.

import { z } from 'zod';
import { GUIDE_TOPIC_NAMES } from '../guides';
import { defineVerb } from '../define';

export const guide = defineVerb({
  id: 'guide',
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
  output: z.object({ text: z.string() }),
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
  text: (s) => [
    `host  ${s.host}`,
    `account  ${s.account}`,
    `token  ${s.token}`,
    `role  ${s.role}`,
    `expires  ${s.expires}`,
    `source  ${s.source}`,
  ],
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
