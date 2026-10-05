# Community blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint | Spec silence                         | Default applied                                                                                                                    |
| --- | --------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| C1  | community | Which migration number               | 0068 (0067 went to agent changesets)                                                                                               |
| C2  | community | Post id shape                        | 10 characters from the share-code alphabet, so post URLs read like share links                                                     |
| C3  | community | How far Load More pages              | Offset paging capped at 2400 (100 pages); beyond that, search or filter                                                            |
| C4  | community | How many popular tags                | 24, by number of listed posts                                                                                                      |
| C5  | community | How search matches                   | Up to 5 whitespace-separated terms, each a case-insensitive substring of title, description or tags (AND)                          |
| C6  | community | Shape of the community key           | A UUID v4 from `crypto.randomUUID`, validated by pattern on the worker                                                             |
| C7  | community | Rate for likes and reports           | 30 writes per 60 s per network, a dedicated limiter so it never competes with document writes                                      |
| C8  | community | Order of More Like This              | Same category, most liked first, newest as the tie-break, the post itself excluded                                                 |
| C9  | community | Port for local development           | 3005 (3002 live, 3003 telemetry, 3004 help)                                                                                        |
| C10 | community | Anonymous posts before the option    | Migration 0069 adds `anonymous` with default 0: posts published before it keep their author's name; new posts default to anonymous |
| C11 | community | How long search waits                | 300 ms after the last keystroke (`SEARCH_DEBOUNCE_MS`, `apps/community/lib/config.ts`); Enter filters at once                      |
| C12 | community | How long My Shares waits for sign-in | 10 s (`SESSION_LOAD_TIMEOUT_MS`, `apps/community/lib/session.ts`), then the error state with Try Again (reload)                    |
| C13 | community | How many skeleton cards              | 8 on the first load (two rows at the widest grid), 4 while Load More fetches (`GalleryView.tsx`)                                   |
| C14 | community | Retry for a missing Clerk token      | One retry after 300 ms (`TOKEN_RETRY_MS`, `apps/community/components/auth/ClerkSession.tsx`)                                       |
| C15 | community | How much one network counts          | At most 5 likes and 5 copies per network per post (`COMMUNITY_COUNTED_PER_NETWORK`)                                                |
| C16 | community | How wide a network is                | IPv4 /24, IPv6 /56 (`communityNetwork`, `apps/api/src/community-network.ts`); unparseable is its own network                       |
| C17 | community | How long responses cache             | Featured `public, max-age=60`; a community link's card image `public, max-age=30` with no stale window                             |
