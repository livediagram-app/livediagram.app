// Who is signed in, for My Shares only. The rest of the Community needs no identity, so the session is asked for only
// once My Shares is chosen (components/auth).

export type CommunitySession = {
  loaded: boolean;
  signedIn: boolean;
  // Who is signed in (null signed out), so an answer for one account is never shown for another.
  userId: string | null;
  // A fresh access token for the api's Authorization header; null when signed out.
  getToken: () => Promise<string | null>;
};

// How long My Shares waits for the session before it gives up and offers Try Again (a network failure): long
// enough for a slow connection, short enough not to look stuck.
export const SESSION_LOAD_TIMEOUT_MS = 10_000;

// How long the search box waits after the last keystroke before it filters.
export const SEARCH_DEBOUNCE_MS = 300;
