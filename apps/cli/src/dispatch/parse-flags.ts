// A verb's words and flags into its input (blueprint "One command" step 2): positionals in the verb's order,
// every other input key a `--kebab-case` flag, then the verb's schema. An unknown flag or a missing
// argument is a usage error (exit 2).

import { parseArgs } from 'node:util';
import type { Verb } from '@livediagram/agent-verbs';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import { fieldsOf, flagOf, type Field } from './fields';

const usage = (verb: Verb, message: string) =>
  new CliError({
    exit: EXIT.usage,
    code: 'usage',
    message,
    hint: `livediagram ${verb.id.replace('.', ' ')} --help`,
  });

// node:util parseArgs names the offending flag in quotes: one the verb does not take, a valued flag without
// its value, or a switch given one.
function flagError(verb: Verb, fields: readonly Field[], err: unknown): CliError {
  const flag = /'(-{1,2}[\w-]+)/.exec(String(err))![1]!;
  const field = fields.find((f) => flagOf(f.key) === flag);
  if (!field) return usage(verb, `unknown flag ${flag} for "${verb.id.replace('.', ' ')}"`);
  return usage(verb, field.kind === 'boolean' ? `${flag} takes no value` : `${flag} needs a value`);
}

export function parseVerbArgs(verb: Verb, words: readonly string[]): unknown {
  const positionals = verb.cli?.positionals ?? [];
  const fields = fieldsOf(verb.input).filter((f) => !positionals.includes(f.key));
  const options = Object.fromEntries(
    fields.map((f) => [
      flagOf(f.key).slice(2),
      { type: f.kind === 'boolean' ? ('boolean' as const) : ('string' as const) },
    ]),
  );
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({ args: [...words], options, strict: true, allowPositionals: true });
  } catch (err) {
    throw flagError(verb, fields, err);
  }
  if (parsed.positionals.length > positionals.length)
    throw usage(verb, `unexpected "${parsed.positionals[positionals.length]}"`);
  const input: Record<string, unknown> = {};
  positionals.forEach((key, i) => {
    const value = parsed.positionals[i];
    if (value !== undefined) input[key] = value;
  });
  for (const field of fields) {
    const value = parsed.values[flagOf(field.key).slice(2)];
    if (value !== undefined) input[field.key] = value;
  }
  const checked = verb.input.safeParse(input);
  if (!checked.success) {
    const issue = checked.error.issues[0]!;
    const key = String(issue.path[0]);
    const name = positionals.includes(key) ? `<${key}>` : flagOf(key);
    throw usage(
      verb,
      issue.code === 'invalid_type' && input[key] === undefined
        ? `missing ${name}`
        : `${name}: ${issue.message}`,
    );
  }
  return checked.data;
}
