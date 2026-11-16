// Which not-found card an editor shows (each product's new-file route spec, "Which not-found card"). Every refusal the
// api answers 404 is one card; what it says depends only on what the visitor brought (the address, a share code) and
// who they are, never on whether the item exists, so a missing item and a private one always read alike. Kept apart
// from the card (components/chrome/NotFound.tsx, loaded lazily) so the editor page can title its status shell without
// pulling the card into its first load.

export type NotFoundReason = 'page' | 'access-ended' | 'dead-link' | 'sign-in' | 'missing';

export type NotFoundInput = {
  // The address names no item (a mistyped or retired page).
  page: boolean;
  // The item was open a moment ago and access to it ended (lib/access-notice.ts).
  accessEnded: boolean;
  // The address carries a share code (`?s=`), which the api refused: unknown, revoked or expired alike.
  shareLink: boolean;
  // Nobody is signed in (a guest, or no one), where signing in is offered: never inside an embed.
  signedOut: boolean;
};

/** The first case that fits, in the spec's order. */
export function notFoundReason({
  page,
  accessEnded,
  shareLink,
  signedOut,
}: NotFoundInput): NotFoundReason {
  if (page) return 'page';
  if (accessEnded) return 'access-ended';
  if (shareLink) return 'dead-link';
  if (signedOut) return 'sign-in';
  return 'missing';
}

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** The card's heading, which the status shell also names the browser tab after. `embed`: inside someone else's page,
 *  where a refused share code says the item is no longer shared. */
export function notFoundTitle(reason: NotFoundReason, noun: string, embed = false): string {
  switch (reason) {
    case 'page':
      return 'Page Not Found';
    case 'access-ended':
      return 'No Longer Shared With You';
    case 'dead-link':
      return embed ? 'No Longer Shared' : 'Link Not Valid';
    default:
      return `${capitalised(noun)} Not Found`;
  }
}

/** Whether the address carries a share code, the one input the page reads off the address itself. */
export function addressHasShareCode(search: string): boolean {
  return new URLSearchParams(search).has('s');
}
