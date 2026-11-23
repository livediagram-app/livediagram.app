# Tiers blueprint

Derived from [Tiers in liveknowledge](../tiers.md). It applies only with Pro on. With Pro off, every function below
answers the legacy figure and nothing asks the subscription service.

## Where the tier is read

- **The room** has the platform's `ItemTier` (`room.tier`, built by `roomTier` from @liveworkspace/automations/room
  over the `document` row). The tree ops and Automations' Add Tab read it there. The daily prune asks the service
  for a confirmed tier instead (`confirmedHistoryDays`). The room reads it again when it is over a minute old (`tier.fresh()`, then
  `tier.refresh()`), before a check that needs it.
- **The Worker** (`subscriptionOf(env)` in `src/subscription.ts`, one entitlement cache an isolate) reads the owner's
  limits for the document's read and for the routes that run outside the room: the metadata save, the changeset add,
  the agent's create, the seeded create (the creator's own scope), Ask, and Describe to Set Up. `itemPayer` names
  who pays, and the conflict check spends from the room.

## Pages

Spec "Knowledgebase Pages" (2026-11-22: the owner's pages over every knowledgebase, a standing item count).

- `knowledgePagesMax()`, in `src/knowledge/tier-limits.ts`, is the fixed per-knowledgebase bound,
  `MAX_KNOWLEDGEBASE_PAGES` (500), on every tier. The package's checks (`pageAddRefusal`, `pageTreeRefusal`,
  `tabListRefusal`, `tabParentRefusal`) take `max` as an argument, which defaults to 500; `pageTreeConflict(reason)`
  answers their refusal, with no tier fields.
- `countPages(tier, documentId, pages)` tells the service the knowledgebase's new count (ItemTier's
  `count('pages', documentId, pages, true)` in the room, `WorkerTier.count` on the Worker) and answers null (let
  through), `{ used, max }` at the owner's limit, or `'unavailable'` when the service refused the request.
  `pagesRefused(tier, refused)` answers it: 409 `page_limit` with `tierRefusal('knowledgebasePages')`, or 503.
  Called by the tab save of a new page (`tab-put-route.ts`), the agent's add (`knowledge-agent-routes.ts`), a
  changeset that makes a page (`changesets/submit.ts`), the seeded create (`documents.ts`, the creator's tier),
  the Trash's restore (`page-trash-routes.ts`) and Automations' Add Tab (`kit-add-tab.ts`, the room's tier).
- A page to the Trash (`document-subresource-routes.ts` DELETE) tells the new count with `WorkerTier.recount`, in
  `waitUntil`.
- The document's read adds `knowledgeTier: { pagesMax, pagesLimit?, historyDays, owner?, guest? }` with Pro on.
- The editor: `lib/use-pages-bound.ts` (`usePagesBoundOf`) works out what bounds the open knowledgebase from
  `pagesMax` and, for the owner or the owning team, `tierUsage(tier, 'pages')` from their own subscription
  (`pagesBound` in `lib/knowledge-import/import-trim.ts`: `limit - (used - existing)`, or the fixed bound when less).
  `PageTreeLimit` (the meter from 80%, then LimitNotice at the owner's limit, or a plain Callout at the fixed bound)
  closes `PageTreeSidebar`. The import plan takes the bound's `max` as its `pages` limit and, once the person chooses
  Import First N, `trimToRoom`; `import-trim.ts` words the offer and the finished step's note (`ImportTrimOffer.tsx`).
  The page tree's own add checks (New Page, Add Subpage) keep to the fixed bound: an add past the owner's limit is
  refused by the save.

## Built-in AI credits

- `spendBuiltInCredit(env, document)` in `src/knowledge/ai-credits.ts` spends one `aiCredits` from the payer's
  month. It answers `null` (go ahead, or not metered), a `credits` figure to pass on, `{ refused }` (the 429 body),
  or `'unavailable'` (503). It is called right after the built-in caps pass in `handleAsk` and
  `handleSetupSuggest`. `runConflictCheck` calls the room's `tier.spend('aiCredits')` once for each check it runs on
  built-in AI.
- Ask's stream answers `X-AI-Credits: used/limit`, and the setup answer carries `credits: { used, limit }`.
  `AiCreditsLine` shows the line and the used-up notice under the Ask box and in the setup dialog.

## AI Knowledge History

- `historyDays(tier)` gives `aiKnowledgeHistoryDays`, or `READS_KEPT_DAYS` (90) with Pro off. `pruneKnowledge` drops
  `page_reads` and `agent_seen` past it.
- The overview's read takes `days` (30, 90 or 365, clamped to the kept days) for Most Read, and answers
  `history: { days, owner?, guest? }` with Pro on. `MostReadPeriod` is the segmented control, and the card's
  ProNote sits under it.

## Public Knowledgebases

- The count is Publish to the Web's ([blueprint](publishing.md) P28 to P32): the `publicKnowledgebases` gauge, one
  key per published knowledgebase (its document id), claimed by `WorkerTier.claim` in the routes and by the room's
  `ItemTier` in its upkeep, purge and moves (`src/publishing/published-gauge.ts`). `published_site.counted` marks
  whether the site holds its place; a site that holds none answers no public read.
- The refusal is `publish_limit_reached` (409) with the shared `tierRefusal('publicKnowledgebases')` fields. The
  editor's `PublishLimit` words it with `publishLimitSentence` in the shared LimitNotice.
