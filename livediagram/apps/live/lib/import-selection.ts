// What a many-file import's list has ticked (docs/specs/020-import-export/board-import.md).

/** `key` ticked or unticked. */
export function toggled(checked: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(checked);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** Everything ticked, or nothing when everything already is. */
export function toggledAll(
  checked: ReadonlySet<string>,
  keys: readonly string[],
): ReadonlySet<string> {
  return new Set(keys.every((k) => checked.has(k)) ? [] : keys);
}
