# Community blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint | Spec silence                           | Default applied                                                                                                              |
| --- | --------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| C1  | community | Where the canvas keeps its post        | One `community_post` row in its own Durable Object's SQLite; the posts themselves are the Community service's                |
| C2  | community | Post id shape                          | 10 characters from the share-code alphabet, so post URLs read like share links                                               |
| C3  | community | How far Load More pages                | Offset paging capped at 2400 (100 pages); beyond that, search or filter                                                      |
| C4  | community | How many popular tags                  | 24, by number of listed posts                                                                                                |
| C5  | community | How search matches                     | Up to 5 whitespace-separated terms, each a case-insensitive substring of title, description or tags (AND)                    |
| C6  | community | Shape of the community key             | A UUID v4 from `crypto.randomUUID`, validated by pattern at the service (`COMMUNITY_KEY_PATTERN`)                            |
| C7  | community | Rate for likes and reports             | 30 writes per 60 s per network, the Community service's own limiter                                                          |
| C8  | community | Order of More Like This                | Same category, most liked first, newest as the tie-break, the post itself excluded                                           |
| C9  | community | Port for local development             | 3105 (livediagram's block, 3100 onward)                                                                                      |
| C10 | community | Whether a post is anonymous by default | New posts default to anonymous; the author can show their name                                                               |
| C11 | community | How long search waits                  | 300 ms after the last keystroke (`SEARCH_DEBOUNCE_MS`, `packages/community-site/src/lib/session.ts`); Enter filters at once  |
| C12 | community | How long My Shares waits for sign-in   | 10 s (`SESSION_LOAD_TIMEOUT_MS`, `packages/community-site/src/lib/session.ts`), then the error state with Try Again (reload) |
| C13 | community | How many skeleton cards                | 8 on the first load (two rows at the widest grid), 4 while Load More fetches (`GalleryView.tsx`)                             |
| C14 | community | When to ask for a fresh token          | A minute before the access token expires (`EXPIRY_MARGIN_MS`, community-site `AccountSession.tsx`)                           |
| C15 | community | How much one network counts            | At most 5 likes and 5 copies per network per post (`COMMUNITY_COUNTED_PER_NETWORK`)                                          |
| C16 | community | How wide a network is                  | IPv4 /24, IPv6 /56 (`communityNetwork`, packages/community/src/network.ts); unparseable is its own network                   |
| C17 | community | How long responses cache               | The service's featured `public, max-age=60`; a community link's card image is liveworkspace's previews' to cache             |
