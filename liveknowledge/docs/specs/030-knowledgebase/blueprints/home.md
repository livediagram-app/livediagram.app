# Home blueprint

Derived from [Knowledgebase Home](../knowledgebase-home.md): the start of liveknowledge for a signed-in person, over
the index's list and the knowledge routes' `summary` and `search`
([knowledge UI blueprint](knowledge-ui.md) "The client"). **Nothing here is verified in a browser.** The
illustration alone was looked at: drawn to a PNG from the same coordinates, light and dark.

| Piece                                               | File                                    |
| --------------------------------------------------- | --------------------------------------- |
| the list, the numbers, the merge, the summary cache | `lib/knowledge-home/home-data.ts`       |
| links                                               | `lib/knowledge-home/home-links.ts`      |
| what Home hands the editor                          | `lib/knowledge-home/arrival-handoff.ts` |
| the screen and who sees it                          | `components/home/HomeScreen.tsx`        |
| the hero, the field, the results                    | `components/home/HomeHero.tsx`          |
| the illustration                                    | `components/home/HomeIllustration.tsx`  |
| the sections                                        | `components/home/HomeSections.tsx`      |
| the data and the search                             | `useHomeData.ts`, `useHomeSearch.ts`    |
| the routes                                          | `app/page.tsx`, `app/home/page.tsx`     |

## Routes and who sees it

- `app/page.tsx` (the editor app's root) forwards a visitor's `?s=<code>` to `/document/shared` as before, and
  otherwise draws `HomeScreen`. `app/home/page.tsx` draws the same screen; `home` is in `LIVE_ROUTE_SEGMENTS`
  (`packages/api-schema/src/page-views.ts`), which the router routes by, so `/home` reaches the editor app. Both load
  the screen with `next/dynamic` (`ssr: false`) behind the opening screen.
- `HomeScreen` reads `useAccountBootstrap()`. Until `authLoaded` it shows the opening screen and asks for nothing.
  Not signed in, it replaces the address with `/new` and its query (the forked start's behaviour: a guest's
  knowledgebase kept Offline, the editor with no sign-in wall). Signed in, it draws Home under the app's header
  (`EditorHeader`: the logo to the Explorer, the account).

## Data

- **The list:** one `indexClient.listItems({ app: 'liveknowledge', limit: 100 })`. `homeKnowledgebases` leaves out
  what is in the Trash or Archived, orders by the later of `updatedAt` and `lastOpenedAt`, and keeps
  `HOME_KNOWLEDGEBASES_MAX` (12) with the total, for **See All** (the Explorer).
- **Summaries:** `apiKnowledgeSummary` for each of the twelve, all at once (`Promise.all`), through
  `createSummaryCache`: a summary's promise is kept `HOME_SUMMARY_TTL_MS` (60,000) per account for the tab's life; a
  failed read is dropped so the next ask reads again. Each summary sets state as it lands. A knowledgebase whose
  Review Period was changed in this browser is marked stale (`markSummaryStale`, from the editor's `applyPeriod`):
  the next ask for it reads past the kept promise and the browser's own copy (`cache: 'reload'`), so the card's
  verified share and Yours to Review follow the new period on the next visit, not a minute later.
- **Requests on open:** 1 list, then for each of at most 12 knowledgebases 1 grant (the api funnel's, kept ten
  minutes) and 1 summary: 25 at most, none repeated inside a minute. Not measured against a server.
- **`recentPagesAcross`** merges the summaries' `recent` and keeps the newest `HOME_RECENT_PAGES` (8).
- **Yours to Review** (`reviewPagesAcross`, `useStillRight`): each summary carries `yoursToReview`, the caller's own
  pages whose review is due (`ownDuePages` in the api's `knowledge-reads.ts`: the page's `knowledge.owner` is the
  caller's account, it is verified, and the knowledgebase's Review Period is past since then (none under Never);
  each `reviewAt` is its `verifiedAt` plus that period, worked out by the read; the longest overdue first,
  `OWN_DUE_PAGES` (10) a knowledgebase; none for a caller with no account). Home merges them, the longest overdue
  first, so the section costs no request beyond the summaries. **Still Right** hides the row at once and calls
  `apiVerifyPage`; a refusal or a failure brings the row back with the toast "Could not verify “<title>”. Try
  again."; once it lands, that one knowledgebase's summary is read again with `cache: 'reload'` (the route's answer
  is `private, max-age=60`, so a plain read, or a reload of Home inside the minute, would list the page again) and
  its card's numbers follow. Measured (`knowledge-search-routes.test.ts`): the summary of a full knowledgebase, 500
  pages of 4,000 characters, every one the caller's and due, takes 3 ms of CPU, held under `cpuBudgetMs(150)`.
- **Search** (`useHomeSearch`): from `HOME_SEARCH_MIN_CHARS` (2), after `SEARCH_DEBOUNCE_MS` (150), one
  `apiSearchKnowledge` per knowledgebase shown, all at once, each with the effect's `AbortSignal`; the next words
  abort them. `mergeSearchResults` takes rank 1 of every knowledgebase, then rank 2, and so on, title rows ahead at
  each rank, `HOME_SEARCH_RESULTS` (12) at most. While the next words are searched the last results stay. Every
  search failing shows "Search Is Not Answering"; some failing shows what the others found.
- **Worst case per keystroke burst:** 12 requests in flight, the 12 before them aborted; each route is rate limited
  at 120 a minute a caller per knowledgebase.

## Layout and states

- `main` is `max-w-6xl`. **The hero** is a grid: one column, then from `lg` two (`1fr` and at most 34rem). Eyebrow
  (12px, uppercase, 0.14em), the heading at 46px with -0.025em tracking and 1.08 leading (34px below `sm`), the
  pitch, the field (56px tall at least, rounded 2xl, a brand ring on focus), the scope row (32px tall at least
  whether the list is in or not) and **Ask Again**.
- **The results** hang under the field (`absolute`, `--z-toolbar`, 22rem tall at most) while it or they hold the
  focus; Arrow Down moves into them, Escape closes them. A row is a link: the page icon, the title with the matched
  words marked (`markedParts` over the route's U+0002 and U+0003, drawn as text), the tick or Due pill, the snippet,
  then "<knowledgebase> › <headings>".
- **The illustration** has `aspect-[7/5]` and a width, so its box is its shape before it paints. Flat fills only:
  the platform `brand-200` (edges `brand-400` and `brand-500`; `brand-900`, `600`, `700` in dark), the ring
  `brand-500`, the large cube `brand-300` on top, `#65a30d` at the left and `brand-700` at the right (the three
  limes asked for; the left sits between the ramp's 500 and 600, so it is written out), each small cube its colour's
  300, 500 and 700, the cards white (`slate-800` dark) with a `slate-900` (`slate-100`) outline and a `brand-400`
  shadow set off 7px. `role="img"` with one label; its one child group is `aria-hidden`.
- **Cards** are 116px tall links. Loading the list: four skeleton cards of that height. Loading a summary: two
  skeleton bars in the card's own room. Failed summary: "Its numbers could not be read."
- **Recently Updated:** four skeleton rows while the list or the first summaries are read; "No Pages Updated Yet"
  when there are none.
- **No knowledgebases:** the hero with its field disabled and no scope chip, then one `EmptyState`, "No
  Knowledgebases Yet", with **Make Your First Knowledgebase** (`/new`) and **Import**.
- **The list failed:** an error callout with **Try Again**.
- Hover and focus changes run on `duration-micro` under `motion-safe`; skeletons pulse under `motion-safe` only.

## What Home hands the editor

`handArrival` writes one record to `sessionStorage` (`liveknowledge:home-arrival:v1`) and the page navigates.
`takeArrival(kind, documentId)` reads it once: taken when it is of that kind, for that knowledgebase (or for none,
which is the one `/new` is about to make) and under `ARRIVAL_TTL_MS` (120,000) old.

- **Ask:** `{ kind: 'ask', documentId, question }`, then `/document/<id>?view=ask`. The Ask view takes it when it
  can ask, starts a new question and asks it.
- **Import:** `{ kind: 'import', documentId }`, then the knowledgebase (`/new?blank=1` with none). The views' host
  takes it once the knowledgebase is here, for someone who may change its pages, and opens the Import dialog.
- **A search result's passage:** `{ kind: 'passage', documentId, tab, block }`, handed as the result's link is
  followed (a passage's result alone; a title's opens the page at its top). The views' host (`usePassageArrival`)
  takes it once the knowledgebase has loaded and calls `goToBlock`, so the page opens at the passage's first block,
  in view and lit, for every role. A result opened in another browser tab carries no handoff and opens at the top.

## Share roles

Home lists what the index lets the person open and links into it; every action it starts is checked where it lands.
Ask from Home is the Ask view's (every signed-in role). Import opens for an Editor of the whole knowledgebase and
does nothing for anyone else. **Still Right** is Verify (Editor with an account). The list is the caller's own whatever their role (a page's owner is a person with access): an Editor's Still
Right verifies; a Participant's or a Viewer's is refused by the route (403), the row comes back and the toast says
so. Tested a role at a time in `knowledge-search-routes.test.ts` "yoursToReview".

## Tests

`lib/knowledge-home/home-data.test.ts` (the list, the numbers, the merge, the cache, the handoff) and
`components/home/HomeScreen.test.tsx` (who sees it, the heading, the illustration's parts and label, example
questions, the summaries in parallel and the card's kept height, twelve and See All, a failed summary, the search
across and its abort, Ask and Import's handoffs, the first visit, Yours to Review).

## Not built, or not known

Listed in the spec's "Not built". Also: Home's own layout, the results panel's placement and the illustration inside
the page have not been seen in a browser; `/` through the router still serves the marketing site.
