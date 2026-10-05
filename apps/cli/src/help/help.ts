// The three help levels (docs/specs/015-api/cli.md "Help"): top, resource and verb, from the catalogue, each
// within its token budget.

import {
  COMMAND_ALIASES,
  RESOURCES,
  TOP_LEVEL,
  verbById,
  verbsOf,
  type Verb,
} from '@livediagram/agent-verbs';
import { fieldsOf, flagOf, keyOf, restName } from '../dispatch/fields';

export const HELP_TOP_MAX_TOKENS = 500;
export const HELP_RESOURCE_MAX_TOKENS = 250;
export const HELP_VERB_MAX_TOKENS = 400;

const verbWord = (v: Verb) => v.id.slice(v.id.indexOf('.') + 1);

export function topHelp(): string {
  const width = Math.max(
    ...RESOURCES.map((r) => `${r.name}${r.alias ? ` (${r.alias})` : ''}`.length),
    ...TOP_LEVEL.map((t) => t.length),
  );
  const pad = (s: string) => s.padEnd(width + 2);
  return [
    'livediagram: read, build, edit and discuss livediagram documents.',
    '',
    'Usage: livediagram <resource> <verb> [args] [flags]',
    '',
    'Resources',
    ...RESOURCES.map(
      (r) =>
        `  ${pad(`${r.name}${r.alias ? ` (${r.alias})` : ''}`)}${verbsOf(r.name).map(verbWord).join(', ')}`,
    ),
    ...TOP_LEVEL.map((t) => `  ${pad(t)}${verbById(t)!.summary.toLowerCase()}`),
    ...Object.entries(COMMAND_ALIASES).map(([word, id]) => `  ${pad(word)}${id.replace('.', ' ')}`),
    '',
    'Addressing',
    '  <doc>     name, id prefix or livediagram URL     "Auth flow", 3f9c',
    '  --tab     tab name or id prefix; the first tab when omitted',
    '',
    'Output',
    '  stdout is data; hints go to stderr. Compact text by default,',
    '  --json for JSON (--json=a,b picks fields), -q for refs and ids only.',
    '  Exit: 0 done, 1 rejected, 2 usage, 3 not found, 4 auth,',
    '  5 conflict, 6 rate limited, 7 network or server.',
    '',
    'Start',
    '  livediagram document ls auth        find a document',
    '  livediagram tab view "Auth flow"    its first tab, as an outline',
    '  livediagram tab lint "Auth flow"    what is wrong with how it is drawn',
    '  livediagram guide edit              change a tab with edit operations',
    '',
    'Sign in: LIVEDIAGRAM_TOKEN, or livediagram auth login --with-token. Never prompts.',
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
