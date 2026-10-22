// Home's hero holds the lens field (docs/specs/013-workspace/explorer-filters.md "The field"). Typing in it opens
// Search results, which unmounts the hero; the header's field mounts there and takes the focus, caret after the typed
// words, so typing carries on. A module flag rather than state: the two fields never share a render.

let pending = false;

/** The hero field asks the next header field to mount to take the focus. */
export function requestBarFocus(): void {
  pending = true;
}

/** The header field, on mount: whether it should take the focus. Answers once. */
export function takeBarFocus(): boolean {
  const take = pending;
  pending = false;
  return take;
}
