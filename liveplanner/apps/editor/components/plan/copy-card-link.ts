// Copy Link in the item panel's ⋯ menu (docs/specs/026-plan/plan-board.md "Its address"): the card's address to the
// clipboard, said in a toast either way. A browser with no clipboard (or one that refuses) says so.
export const LINK_COPIED = 'Link copied';
export const LINK_NOT_COPIED = "Couldn't copy the link";

export function copyCardLink(link: string, notify: ((message: string) => void) | undefined): void {
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
  if (!clipboard) {
    notify?.(LINK_NOT_COPIED);
    return;
  }
  void clipboard.writeText(link).then(
    () => notify?.(LINK_COPIED),
    () => notify?.(LINK_NOT_COPIED),
  );
}
