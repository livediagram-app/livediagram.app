// A verb's words and flags into its input (blueprint "One command" step 2): positionals in the verb's order,
// every other input key a `--kebab-case` flag, then the verb's schema. An unknown flag or a missing
// argument is a usage error (exit 2).

import { parseArgs } from 'node:util';
import type { Verb } from '@livediagram/agent-verbs';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import { fieldsOf, flagOf, keyOf, restName, type Field } from './fields';

const usage = (verb: Verb, message: string) =>
  new CliError({
    exit: EXIT.usage,
    code: 'usage',
    message,
    hint: `livediagram ${verb.id.replace('.', ' ')} --help`,
  });

// node:util parseArgs names the offending flag in quotes ('-f, --file <value>' for a short one): one the verb does
// not take, a valued flag without its value, or a switch given one.
function flagError(verb: Verb, fields: readonly Field[], err: unknown): CliError {
  const flag = /'(-{1,2}[\w-]+)/.exec(String(err))![1]!;
  const field = fields.find((f) => flagOf(f.key) === flag || `-${shortOf(verb, f.key)}` === flag);
  if (!field) return usage(verb, `unknown flag ${flag} for "${verb.id.replace('.', ' ')}"`);
  const name = flagOf(field.key);
  return usage(verb, field.kind === 'boolean' ? `${name} takes no value` : `${name} needs a value`);
}

const shortOf = (verb: Verb, key: string) => verb.cli?.flags?.[key]?.short;

export function parseVerbArgs(verb: Verb, words: readonly string[]): unknown {
  const positionals = verb.cli?.positionals ?? [];
  const positionalKeys = positionals.map(keyOf);
  const rest = positionals.length > 0 && restName(positionals.at(-1)!) !== null;
  const fields = fieldsOf(verb.input).filter((f) => !positionalKeys.includes(f.key));
  const options = Object.fromEntries(
    fields.map((f) => {
      const short = shortOf(verb, f.key);
      return [
        flagOf(f.key).slice(2),
        {
          type: f.kind === 'boolean' ? ('boolean' as const) : ('string' as const),
          ...(f.kind === 'list' ? { multiple: true } : {}),
          ...(short ? { short } : {}),
        },
      ];
    }),
  );
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({ args: [...words], options, strict: true, allowPositionals: true });
  } catch (err) {
    throw flagError(verb, fields, err);
  }
  if (!rest && parsed.positionals.length > positionals.length)
    throw usage(verb, `unexpected "${parsed.positionals[positionals.length]}"`);
  const input: Record<string, unknown> = {};
  positionalKeys.forEach((key, i) => {
    const isRest = rest && i === positionalKeys.length - 1;
    const value = isRest ? parsed.positionals.slice(i) : parsed.positionals[i];
    if (isRest ? (value as string[]).length > 0 : value !== undefined) input[key] = value;
  });
  for (const field of fields) {
    const value = parsed.values[flagOf(field.key).slice(2)];
    if (value !== undefined) input[field.key] = value;
  }
  const checked = verb.input.safeParse(input);
  if (!checked.success) {
    const issue = checked.error.issues[0]!;
    const key = String(issue.path[0]);
    const position = positionals[positionalKeys.indexOf(key)];
    const name = position ? (restName(position) ? `<${key}…>` : `<${key}>`) : flagOf(key);
    throw usage(verb, input[key] === undefined ? `missing ${name}` : `${name}: ${issue.message}`);
  }
  return checked.data;
}
