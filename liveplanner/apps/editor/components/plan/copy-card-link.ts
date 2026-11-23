// Copy Card Link in the item panel's ⋯ menu (docs/specs/026-plan/plan-board.md "Its address"): the card's address to the
// clipboard, said in a toast either way, naming the card by its title. A browser with no clipboard (or one that
// refuses) says so.
import { toastName } from '@liveworkspace/workbench/lib/toast-name';

export const LINK_COPIED = 'Card link copied';
export const LINK_NOT_COPIED = 'Couldn’t copy the card link';

export function copyCardLink(
  link: string,
  notify: ((message: string) => void) | undefined,
  title?: string,
): void {
  const name = toastName(title);
  const copied = name ? `Link to ${name} copied` : LINK_COPIED;
  const refused = name ? `Couldn’t copy the link to ${name}` : LINK_NOT_COPIED;
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
  if (!clipboard) {
    notify?.(refused);
    return;
  }
  void clipboard.writeText(link).then(
    () => notify?.(copied),
    () => notify?.(refused),
  );
}
