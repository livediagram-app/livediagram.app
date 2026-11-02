import { useSyncExternalStore } from 'react';
import { defaultSaveLocationFor, type SaveLocationId } from '@/lib/save-locations';
import { readSignedInHint } from '@/lib/signed-in-hint';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

const subscribeNever = () => () => {};
// The prerender has no cookies: it reads as a guest, and the client snapshot follows at hydration.
const serverHint = () => false;

// How long a create waits for a session that looks signed in before it keeps the new item in This Browser.
const SESSION_WAIT_MS = 15_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// The session has answered: an account, or its own word (`sessionAnswered`, else `authLoaded`) that there is none.
const answered = (s: {
  authLoaded: boolean;
  sessionAnswered?: boolean;
  accountUserId: string | null | undefined;
}) => !!s.accountUserId || (s.sessionAnswered ?? s.authLoaded);

// Where /new stores a new document (docs/specs/006-document/save-locations.md "The default depends on who is
// creating"); nobody is asked. Every create decides once, at commit: a `/new?folder=` / `?team=` context names a server
// place, so it is livehuddle whoever is creating; otherwise a guest is known at once and never waits, and a browser
// that looks signed in (the `ld_signed_in` hint, docs/specs/014-identity/auth-and-guest-access.md "Who is a guest,
// before sign-in answers") waits for identity (`settle`, the page's own wait) and then reads the settled answer, so a
// signed-in person is never handed a document in This Browser.
export function useNewDocumentLocation(opts: {
  authLoaded: boolean;
  // Whether the session itself has answered (useAccountBootstrap); `authLoaded` alone when not given.
  sessionAnswered?: boolean;
  accountUserId: string | null | undefined;
}) {
  const signedInHint = useSyncExternalStore(subscribeNever, readSignedInHint, serverHint);
  const latest = useLatest({ ...opts, signedInHint });

  const resolveSaveLocation = async (
    hasPlacementParams: boolean,
    settle: () => Promise<unknown>,
    // The wizard's Sync Canvas to Server switch, once the person has flipped it (save-locations.md "On the start
    // screen"); null follows the default.
    chosen: SaveLocationId | null = null,
  ): Promise<SaveLocationId> => {
    if (hasPlacementParams) return 'livehuddle';
    if (chosen) return chosen;
    // A browser that looks signed in waits for its session's own answer: the page's 5 s give-up settles
    // `authLoaded` with no one in it, and reading that as a guest made a signed-in person's create This Browser.
    if (!latest.current.accountUserId && readSignedInHint()) {
      if (!latest.current.authLoaded) await settle();
      const until = Date.now() + SESSION_WAIT_MS;
      while (!answered(latest.current) && Date.now() < until) await sleep(100);
    }
    const now = latest.current;
    // Only a known account saves on the server: a guest, or a session that never answered, stays in This Browser.
    const location = defaultSaveLocationFor({ signedIn: !!now.accountUserId });
    debugLog(`[new] save location=${location} answered=${answered(now)}`);
    return location;
  };

  // Whether the person looks signed in now, for the wizard's switch before anything is flipped: the settled answer, or
  // the hint until sign-in answers.
  const signedIn = opts.authLoaded ? !!opts.accountUserId : signedInHint;
  return { resolveSaveLocation, signedIn };
}
