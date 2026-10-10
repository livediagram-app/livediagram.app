import { useSyncExternalStore } from 'react';
import { clerkEnabled } from '@/lib/clerk-config';
import { defaultSaveLocationFor, type SaveLocationId } from '@/lib/save-locations';
import { readSignedInHint } from '@/lib/signed-in-hint';
import { useLatest } from '@/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';

const subscribeNever = () => () => {};
// The prerender has no cookies: it reads as a guest, and the client snapshot follows at hydration.
const serverHint = () => false;

// Where /new saves a document nobody placed (docs/specs/006-document/save-locations.md "The default depends
// on who is creating"). Before auth settles, who is creating is the `__client_uat` hint
// (docs/specs/014-identity/auth-and-guest-access.md "Who is a guest, before Clerk answers"); after, the
// settled answer. A /new?folder= / ?team= context names a server place, so it is livediagram whoever
// is creating.
export function useNewDocumentLocation(opts: {
  authLoaded: boolean;
  clerkUserId: string | null | undefined;
  hasPlacementContext: boolean;
}) {
  const { authLoaded, clerkUserId, hasPlacementContext } = opts;
  const signedInHint = useSyncExternalStore(subscribeNever, readSignedInHint, serverHint);
  const signedIn = authLoaded ? !!clerkUserId : signedInHint;
  const defaultLocation: SaveLocationId = hasPlacementContext
    ? 'livediagram'
    : defaultSaveLocationFor({ signedIn, clerkEnabled });
  const latest = useLatest({ authLoaded, clerkUserId, signedInHint });

  // The wizard-less links (?template=, ?blank=1) decide once, at commit. A guest is known at once and
  // never waits; a browser that looks signed in waits for identity (`settle`, the page's own wait)
  // and then reads the settled answer, so a signed-in person is never handed a Local only document.
  const resolveBypassLocation = async (
    hasPlacementParams: boolean,
    settle: () => Promise<unknown>,
  ): Promise<SaveLocationId> => {
    if (hasPlacementParams || !clerkEnabled) return 'livediagram';
    if (!latest.current.authLoaded && latest.current.signedInHint) await settle();
    const now = latest.current;
    const location = defaultSaveLocationFor({
      signedIn: now.authLoaded ? !!now.clerkUserId : now.signedInHint,
      clerkEnabled,
    });
    debugLog(`[new] bypass location=${location} settled=${now.authLoaded}`);
    return location;
  };

  return { defaultLocation, resolveBypassLocation };
}
