// The three help levels (docs/specs/015-api/cli.md "Help"): top, resource and verb, from the catalogue, each
// within its token budget.

import { COMMAND_ALIASES, RESOURCES, verbsOf, type Verb } from '@livediagram/agent-verbs';
import { fieldsOf, flagOf, keyOf, restName } from '../dispatch/fields';

export const HELP_TOP_MAX_TOKENS = 500;
export const HELP_RESOURCE_MAX_TOKENS = 250;
export const HELP_VERB_MAX_TOKENS = 400;

const verbWord = (v: Verb) => v.id.slice(v.id.indexOf('.') + 1);

// The rows the top level groups (blueprint "Help", final copy, CLI82): top-level verbs that belong together share a
// line after the resource row they follow, and the commands a first read needs least are only named, on one line.
const GROUPED_ROWS = [
  {
    words: ['wait', 'watch'],
    after: 'presence',
    summary: 'block until, or stream, comments and changes',
  },
  {
    words: ['pull', 'push'],
    after: 'graph',
    summary: 'one document to a file and back; export --all',
  },
  {
    words: ['sync'],
    after: 'link',
    summary: "mirror a link's documents into the repo",
  },
] as const;
export const NAMED_ONLY = [
  'board',
  'sheet',
  'page',
  'article',
  'type',
  'template',
  'icon',
  'schema',
  'guide',
  'skill',
  'api',
  'auth',
  'telemetry',
] as const;

const isNamedOnly = (word: string) => NAMED_ONLY.some((n) => n === word);

// A verb's word, with the command word that names it directly: `apply (edit)`.
const verbWithAlias = (v: Verb) => {
  const alias = Object.entries(COMMAND_ALIASES).find(([, id]) => id === v.id)?.[0];
  return alias ? `${verbWord(v)} (${alias})` : verbWord(v);
};

export function topHelp(): string {
  const label = (r: (typeof RESOURCES)[number]) => `${r.name}${r.alias ? ` (${r.alias})` : ''}`;
  const rows = RESOURCES.filter((r) => !isNamedOnly(r.name));
  const groupLabel = (g: (typeof GROUPED_ROWS)[number]) => g.words.join(', ');
  const width = Math.max(
    ...rows.map((r) => label(r).length),
    ...GROUPED_ROWS.map((g) => groupLabel(g).length),
  );
  const pad = (s: string) => s.padEnd(width + 2);
  return [
    'livediagram: read, build, edit and discuss documents.',
    'Usage: livediagram <resource> <verb> [args] [flags]',
    '',
    ...rows.flatMap((r) => [
      `  ${pad(label(r))}${verbsOf(r.name).map(verbWithAlias).join(', ')}`,
      ...GROUPED_ROWS.filter((g) => g.after === r.name).map(
        (g) => `  ${pad(groupLabel(g))}${g.summary}`,
      ),
    ]),
    `  ${NAMED_ONLY.join(', ')}`,
    '',
    '<doc> is a name, id prefix or link; --tab a tab name or id prefix (first by default).',
    'stdout is data, hints stderr; --json (=a,b picks fields), -q refs only.',
    'Exit 0 done, 1 refused, 2 usage, 3 not found, 4 auth, 5 conflict, 6 rate limit, 7 network.',
    '',
    'Start',
    '  livediagram document ls auth        find a document',
    '  livediagram tab view "Auth flow"    its first tab, as an outline',
    '  livediagram tab lint "Auth flow"    what is wrong with how it is drawn',
    '  livediagram guide edit              change a tab with edit operations',
    '',
    'Sign in: LIVEDIAGRAM_TOKEN, or auth login --with-token. Never prompts.',
    'More: livediagram <resource> --help, livediagram guide <topic>',
    '',
  ].join('\n');
}

export function resourceHelp(resource: string): string {
  const entry = RESOURCES.find((r) => r.name === resource)!;
  const verbs = verbsOf(resource);
  const width = Math.max(...verbs.map((v) => verbWord(v).length));
  return [
    `livediagram ${resource}: ${entry.summary}`,
    '',
    ...verbs.map((v) => `  ${verbWord(v).padEnd(width + 2)}${v.summary}`),
    '',
    `More: livediagram ${resource} <verb> --help`,
    '',
  ].join('\n');
}

export function verbHelp(verb: Verb): string {
  const command = verb.id.includes('.') ? verb.id.replace('.', ' ') : verb.id;
  const positionals = verb.cli?.positionals ?? [];
  const keys = positionals.map(keyOf);
  const fields = fieldsOf(verb.input);
  const shown = (p: string) => {
    const key = keyOf(p);
    if (restName(p)) return `<${key}…>`;
    return fields.find((f) => f.key === key)?.required ? `<${key}>` : `[${key}]`;
  };
  const usage = [
    `livediagram ${command}`,
    ...positionals.map(shown),
    ...(fields.some((f) => !keys.includes(f.key)) ? ['[flags]'] : []),
  ].join(' ');
  const flags = fields
    .filter((f) => !keys.includes(f.key))
    .map((f) => {
      const short = verb.cli?.flags?.[f.key]?.short;
      const name = `${short ? `-${short}, ` : ''}${flagOf(f.key)}${f.kind === 'boolean' ? '' : ` <${f.values ? f.values.join('|') : f.kind === 'number' ? 'n' : 'text'}>`}`;
      return `  ${name}  ${f.description}`;
    });
  return [
    verb.description,
    '',
    `Usage: ${usage}`,
    ...(flags.length ? ['', 'Flags', ...flags] : []),
    ...(verb.cli
      ? [
          '',
          'Examples',
          ...verb.cli.examples.map((e) => `  ${e}`),
          '',
          `Prints: ${verb.cli.prints}`,
        ]
      : []),
    '',
  ].join('\n');
}
