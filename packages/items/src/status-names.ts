// One name, one status (docs/specs/026-plan/plan-board.md "The board set-up"): a status's name as columns compare
// it, and the status a name already belongs to, so a new column, a placed board or a renamed column reuses the
// status of that name instead of making a second one the cards would be split across.

// A name as statuses compare it: case and spacing (and punctuation) aside, so "To do", "to-do" and "TO  DO" match.
// Letters and digits of any script count ("完成", "Готово"), so a name in any language is matched, not dropped.
export function statusKey(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

// The status already named `name` among `names` (status id to name, in the document's order), or undefined.
export function statusNamed(
  name: string,
  names: Iterable<readonly [string, string]>,
): { status: string; name: string } | undefined {
  const key = statusKey(name);
  if (!key) return undefined;
  for (const [status, n] of names) if (statusKey(n) === key) return { status, name: n };
  return undefined;
}
