// An element command's words as one line-form edit operation (docs/specs/015-api/blueprints/cli.md CLI23): the
// verb, then each word, re-quoted when it holds whitespace, quotes or backslashes (only the value after `key=`,
// `key:` or `key~` when the word has one); `connect <a> <b>` gets its `->`, which a shell would read as a redirect.

const NEEDS_QUOTES = /[\s"\\]/;

const quote = (text: string) => `"${text.replace(/[\\"]/g, (c) => `\\${c}`)}"`;

function requote(word: string): string {
  const keyed = /^([A-Za-z][\w-]*[=:~])(.*)$/s.exec(word);
  if (keyed) {
    const [, key, value] = keyed;
    return NEEDS_QUOTES.test(value!) ? `${key}${quote(value!)}` : word;
  }
  return NEEDS_QUOTES.test(word) ? quote(word) : word;
}

export function argvToOperationLine(verb: string, words: readonly string[]): string {
  const quoted = words.map(requote);
  const parts =
    verb === 'connect' && quoted.length >= 2 ? [quoted[0]!, '->', ...quoted.slice(1)] : quoted;
  return [verb, ...parts].join(' ');
}
