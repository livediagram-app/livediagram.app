// Where keyboard focus goes when a list row is deleted with an Undo toast, and when Undo brings it back
// (liveworkspace/docs/specs/022-interface-design/undo-not-confirm.md "Focus"): to the neighbouring row's control (the
// next, else the previous, else the list's own add button), never left on the page body where F6 has nowhere to hand
// it back to; and after Undo, to the restored row's control. Used by livediagram's slide deck and layers and
// liveknowledge's page tree.

/** What a delete hands its list: called once the row has gone, and once Undo has put it back. */
export type RowFocus = { removed: () => void; restored: () => void };

/** The id that takes focus when `removed` (and anything after it in `gone`) leaves `ids`: the next, else the previous. */
export function neighbourId(
  ids: readonly string[],
  removed: string,
  gone: ReadonlySet<string> = new Set([removed]),
): string | null {
  const at = ids.indexOf(removed);
  if (at < 0) return null;
  for (let i = at + 1; i < ids.length; i++) if (!gone.has(ids[i]!)) return ids[i]!;
  for (let i = at - 1; i >= 0; i--) if (!gone.has(ids[i]!)) return ids[i]!;
  return null;
}

/** How many times focusWhenDrawn looks again for a row still being drawn. */
export const FOCUS_TRIES = 20;

/** Focus what `find` gives once the list has drawn (a row put back appears a render later), looking again on the next
 *  turns until it is there, at most FOCUS_TRIES times. */
export function focusWhenDrawn(
  find: () => HTMLElement | null | undefined,
  tries = FOCUS_TRIES,
): void {
  setTimeout(() => {
    const el = find();
    if (el?.isConnected) el.focus({ preventScroll: true });
    else if (tries > 1) focusWhenDrawn(find, tries - 1);
  }, 0);
}

/** The RowFocus for deleting the row `id` from the list `ids`, its controls found by `control`. */
export function rowFocus(opts: {
  ids: readonly string[];
  id: string;
  // Rows that go with it (a page's subpages).
  gone?: ReadonlySet<string>;
  control: (id: string) => HTMLElement | null;
  // With no row left: the list's add button.
  fallback?: () => HTMLElement | null;
}): RowFocus {
  const next = neighbourId(opts.ids, opts.id, opts.gone);
  return {
    removed: () =>
      focusWhenDrawn(() => (next ? opts.control(next) : null) ?? opts.fallback?.() ?? null),
    restored: () => focusWhenDrawn(() => opts.control(opts.id)),
  };
}
