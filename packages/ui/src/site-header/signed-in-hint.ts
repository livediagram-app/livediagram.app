import { useSyncExternalStore } from 'react';

// Whether a product's readable hint cookie says someone is signed in (docs/specs/019-marketing/marketing-site.md
// "Header"): false in the static HTML, read after hydration. The cookie only picks a link; it authenticates
// nothing. Each product binds it to its own cookie's reader (its HeaderPrimaryCta's useSignedInHint).

const noSubscription = () => () => {};
const signedOutOnServer = () => false;

export function createSignedInHint(
  // True / false from the product's hint cookie, null when there is none.
  readCookie: (cookie: string) => boolean | null,
) {
  const signedInNow = () => readCookie(document.cookie) === true;
  return function useSignedInHint(): boolean {
    return useSyncExternalStore(noSubscription, signedInNow, signedOutOnServer);
  };
}
