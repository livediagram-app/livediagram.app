// An element command's words as one line-form edit operation (docs/specs/015-api/blueprints/cli.md CLI23): the
// verb, then each word, re-quoted when it holds whitespace, quotes or backslashes (only the value after `key=`,
// `key:` or `key~` when the word has one).

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
  return [verb, ...words.map(requote)].join(' ');
}
