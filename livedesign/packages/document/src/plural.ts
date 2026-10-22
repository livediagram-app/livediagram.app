// A count with its noun, `1 element` / `2 elements`: the one wording rule for every count the
// editor, the CLI, the agent views and the lint report print. `many` defaults to `one` plus `s`.

export function pluralWord(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many;
}

export function plural(count: number, one: string, many?: string): string {
  return `${count} ${pluralWord(count, one, many)}`;
}

/** `plural` with the count digit-grouped for the UI (`1,250 shapes`). */
export function pluralGrouped(count: number, one: string, many?: string): string {
  return `${count.toLocaleString('en-GB')} ${pluralWord(count, one, many)}`;
}
