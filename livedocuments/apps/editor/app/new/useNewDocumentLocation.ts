import { useSyncExternalStore } from 'react';
import { defaultSaveLocationFor, type SaveLocationId } from '@/lib/save-locations';
import { readSignedInHint } from '@/lib/signed-in-hint';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';

const subscribeNever = () => () => {};
// The prerender has no cookies: it reads as a guest, and the client snapshot follows at hydration.
const serverHint = () => false;

// Where /new stores a new document (docs/specs/006-document/save-locations.md "The default depends on who is
// creating"); nobody is asked. Every create decides once, at commit: a `/new?folder=` / `?team=` context names a server
// place, so it is livedocuments whoever is creating; otherwise a guest is known at once and never waits, and a browser
// that looks signed in (the `ldoc_signed_in` hint, docs/specs/014-identity/auth-and-guest-access.md "Who is a guest,
// before sign-in answers") waits for identity (`settle`, the page's own wait) and then reads the settled answer, so a
// signed-in person is never handed a document in This Browser.
export function useNewDocumentLocation(opts: {
  authLoaded: boolean;
  accountUserId: string | null | undefined;
}) {
  const signedInHint = useSyncExternalStore(subscribeNever, readSignedInHint, serverHint);
  const latest = useLatest({ ...opts, signedInHint });

  const resolveSaveLocation = async (
    hasPlacementParams: boolean,
    settle: () => Promise<unknown>,
  ): Promise<SaveLocationId> => {
    if (hasPlacementParams) return 'livedocuments';
    if (!latest.current.authLoaded && latest.current.signedInHint) await settle();
    const now = latest.current;
    const location = defaultSaveLocationFor({
      signedIn: now.authLoaded ? !!now.accountUserId : now.signedInHint,
    });
    debugLog(`[new] save location=${location} settled=${now.authLoaded}`);
    return location;
  };

  return { resolveSaveLocation };
}
