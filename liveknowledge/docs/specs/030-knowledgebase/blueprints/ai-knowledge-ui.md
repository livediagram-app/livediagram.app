# AI Knowledge UI blueprint

Derived from [AI Knowledge](../ai-knowledge.md): the knowledgebase's third view, over `GET knowledge` and the routes
its actions call ([api.md](../../015-api/api.md) "Knowledge"). It is drawn on the surface the
[Ask UI blueprint](ask-ui.md) "The views" describes and shares its session, rights, page picker, Draft a Page
and AI Settings. The dashboard was seen in a browser on 2026-11-21; a conflict's row only through a stubbed read.

| Piece                                     | File                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| the read and the actions' runner          | `components/ai-knowledge/useKnowledgeOverview.ts`                                                            |
| the view: its states, actions and dialogs | `components/ai-knowledge/AiKnowledgeView.tsx`                                                                |
| the dashboard's layout and its loading    | `components/ai-knowledge/AiDashboard.tsx`, `DashboardLoading.tsx`                                            |
| the figures band and its sparkline        | `components/ai-knowledge/FigureTiles.tsx`, `ReadsSparkline.tsx`                                              |
| Needs Attention and its rows              | `NeedsAttention.tsx`, `ConflictRow.tsx`, `QuestionRow.tsx`, `SuggestionRow.tsx`                              |
| a card, its cap and Show All              | `components/ai-knowledge/AiSection.tsx`, `useShowAll.tsx`                                                    |
| the other cards                           | `AgentsSection.tsx`, `HealthAndContext.tsx`, `MostReadCard.tsx`                                              |
| an agent's card, its menu and its change  | `AgentCard.tsx`, `useAgentWrite.ts`, `AgentWriteDialog.tsx`; `lib/api/knowledge-agents.ts`                   |
| Connect an Agent                          | the Connect view ([its blueprint](mcp-connect-ui.md))                                                        |
| the owner emails' requests and words      | `lib/api/knowledge-emails.ts`, `lib/knowledge-ask/email-words.ts`                                            |
| the words and the figures                 | `lib/knowledge-ask/overview-words.ts`, `lib/knowledge-ask/dashboard-figures.ts`                              |
| accept and dismiss a suggestion, refusals | `lib/knowledge-ask/suggestions-api.ts`                                                                       |
| the reads by day and Most Read (api)      | `countDailyReads` + `dailyReads`, `countMostRead` in `packages/knowledge/src/sql/reads.ts`; `handleOverview` |

## The read

`useKnowledgeOverview(who, documentId, enabled)` holds `loading`, `ready` or `failed`. It asks `apiKnowledgeOverview`
when the view mounts and each time `refresh()` is called; the effect's `AbortSignal` ends a read the view no longer
wants. A re-read that fails keeps what is on show. `enabled` is false for a knowledgebase kept Offline: no request.
There is no timer.

The figures band and Most Read ask nothing of their own: `handleOverview` runs two more statements in its one
`Promise.all`. `countDailyReads(now)`: `SUM(reads)` by `day` and `reader_kind` over the last `READS_TREND_DAYS` (14)
days, a range of `page_reads`' primary key (day first), at most 28 rows; `dailyReads(rows, now)` fills the days with
none, oldest first. `countMostRead(now)`: the last 7 days' reads by `tab`, people and agents apart, most first then
by tab, `LIMIT 10`; the route drops a tab no longer in the document and keeps `MOST_READ_PAGES` (5). The answer gains
`reads: { days, mostRead }`.

`run(id, action, failureText)` runs one action: a second with the same `id` while the first is out does nothing; the
ids running are `busy` (a button's busy look); a refusal becomes `failure`, said in an error callout above the
sections and cleared when the next action starts; a success calls `refresh()`. So an action costs its own request
and one read.

## The dashboard

`AiDashboard` lays the ready view out (ai-knowledge.md "The view, as built"): the figures band, then the cards in CSS
columns (`lg:columns-2`), each in a `break-inside-avoid` slot, in reading order: Needs Attention, Knowledge Health,
Connected Agents, Always in Context, Most Read, What an Agent Sees. The browser balances the two columns by height.
Below `lg` they are one column. The content is at most `max-w-7xl`, centred, `px-4 sm:px-6`.

- **The figures** (`dashboardFigures(overview)`, pure, in `dashboard-figures.ts`): `readsWeek` (people, agents,
  total, from the last 7 of `reads.days`), `agents` and `writers` (agents whose scopes hold `write`), `questions`
  and `asks` (the sum of `asked`), `conflicts`, `suggestions`, `verifiedShare` (`verified / total`, rounded down to a
  whole percent so a knowledgebase with one page unverified never says 100%) and `reviewDue`.
- **A tile** (`FigureTile`): a `button` (`min-h-[104px]`, the card's border and surface, a brand focus ring, a
  pointer), its words (`text-xs` medium) over its figure (`text-2xl` semibold, tabular) and a line under it; the Reads
  tile adds `ReadsSparkline`. The button's `aria-label` is its words and its figure ("Open Questions: 3", with ",
  needs attention" when it carries the amber dot); its line is its description (`aria-describedby`); its hover
  card (`HoverCard`, `block`) says what pressing it does. A filtering tile is `aria-pressed`.
- **Pressing a tile:** a filter tile sets the Needs Attention filter (or back to `all` when it is on) and scrolls
  Needs Attention into view (`scrollIntoView({ block: 'start', behavior })`, `auto` under reduced motion) and
  focuses its heading's section; any other scrolls its card into view and focuses it (`tabIndex={-1}` on the
  `section`).
- **The sparkline** (`ReadsSparkline`): an `svg` a bar a day, each day a people bar (`fill-brand-700`,
  `dark:fill-brand-300`) under an agents bar (`fill-brand-400`, `dark:fill-brand-600`), heights scaled to the busiest
  day, a 1px hairline for a day with none, `preserveAspectRatio="none"`, 28px high, the tile's width. Inside the
  tile's button it is hidden from screen readers; its words (`readsSparkLabel(days)`) are part of the tile's
  description instead, since a button's content is not read as its own image.
- **Needs Attention** (`NeedsAttention`): an `AiSection` "Needs Attention" with a `SegmentedToggle` ("Show": All,
  Questions, Disagreements, Edits) as its action (under its heading on a phone). `attentionItems(overview,
filter)` orders the rows: conflicts by `foundAt` newest first, suggestions by `createdAt` newest first, questions
  by `asked` most first then `lastAt`. Each row is an `li` with an eyebrow (the kind's icon and word: "Pages
  Disagree", "Suggested Edit", "Unanswered Question") over the row the kind draws (`ConflictRow`, `SuggestionRow`,
  `QuestionRow`), rows divided by a hairline.
- **Caps** (`useShowAll(rows, cap)`): the rows past `cap` are not drawn until **Show All N** (a `ghost` `xs`
  button, `aria-expanded`) is pressed; **Show Fewer** folds them. Caps: Needs Attention 4, Connected Agents 4,
  Always in Context 5. Changing the Needs Attention filter folds it again.
- **Most Read** (`MostReadCard`): an `ol`, a row a page: its title (a button that opens the page, truncated), its
  figures ("12 people, 4 agents" in words for a screen reader, `12 · 4` with two swatches on screen) and a 6px bar
  whose length is the page's reads against the most read, split people and agents in the sparkline's tones.

| Card               | Rows from                               | Empty state                                                                                                           | Writer's actions                                                                                            |
| ------------------ | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Needs Attention    | `conflicts`, `suggestions`, `questions` | "Nothing Needs Attention"; per filter "No Unanswered Questions Yet", "No Disagreements Yet", "No Suggested Edits Yet" | Is Right, Fix the Other; Ask Both Owners; Not a Conflict; Accept; Dismiss; Draft a Page; dismiss a question |
| Connected Agents   | `agents`                                | "No Agents Yet", Connect an Agent                                                                                     | Allow Writing; Stop Writing (an Editor's)                                                                   |
| Knowledge Health   | `health`                                | "No Pages Yet"                                                                                                        | Remind the Owners                                                                                           |
| Always in Context  | `context`                               | "No Pages in Context Yet"                                                                                             | Add a Page; remove                                                                                          |
| Most Read          | `reads.mostRead`                        | "No Reads Yet"                                                                                                        | none (a row opens its page)                                                                                 |
| What an Agent Sees | the read, or nothing                    | a made-up page                                                                                                        | none                                                                                                        |

The key: built-in AI checks for conflicts with no key (`overview.hasAi`), so the dashboard says nothing of a key.
Only on a server with no built-in AI and no key (`hasAi` false) does the Disagreements filter carry a small
`role="note"` line, "This server has no built-in AI, so finding pages that disagree needs your team's AI key." with
**Open AI Settings** (a link-styled button) for `manageAi`, and "Ask an Editor to add one." for anyone else. Draft a
Page from a gap is offered whenever `hasAi`.

## The rows

Each card is `AiSection`: a `section` named by its heading's words (the count sits beside them in a `CountBadge`,
outside the name), one line about it, an optional action at the right, then its rows or a `CompactEmptyState`.

- **Agents.** `agentDoor(agent)`: the row's `door` when the room noted its token; else, from the name, "MCP", "CLI"
  and "API Token" (what the api counts a client under when it sends none), any other name being the client's own.
  `agentScopeChips`: a chip a scope of the row (`Reads`, `Suggests Edits`, `Writes`); a row without scopes shows
  `Reads`. `lastSeenText`: "Last seen today", "yesterday", "N days ago". A top page is a button that shows Pages
  at that page (`openPassage`). `agentWriteChoice`: `allow`, `stop`, or `none` with why; the menu, the dialog and
  the optimistic change are the [agents blueprint](../../024-agents/blueprints/knowledgebase-for-agents.md)'s
  "The editor's control". The More button is named "More for <name>" (its tooltip the same); the menu is
  `useMenuButton` and `useMenu`, its one row a verb with its icon at the left.
- **Connect an Agent** is `showKnowledgeView('connect')`: the [Connect view](mcp-connect-ui.md), which replaced
  the dialog.
- **Conflicts.** Each side shows its title (a button to its page), `trustText` and the passage
  (`whitespace-pre-wrap`, six lines at most). `<A> Is Right, Fix the Other` opens B; `<B> Is Right, Fix the Other`
  opens A, each at the passage that disagrees: a side carries `firstBlock` (the passage's `first_block`, from the
  overview route), and `openPassage(chrome, tab, block)` brings that block into view and lights it, the search
  dialog's own way in (`goToBlock`). A side's title opens its page at its passage the same way. Not a Conflict is `apiDismissKnowledgeConflict`.
- **The owner emails.** `canEmailOwners` is `askRights.emailOwners` (an Editor or a Participant of the whole
  knowledgebase with an account) and `reviewEmails.available`. **Ask Both Owners** (a mail icon, `secondary`) sits before Not a Conflict
  while the conflict has no `askedAt`; with one, `ownersEmailedText('ask', …)` ("Owners asked 14 Nov") is there
  instead. **Remind the Owners** (a bell icon) is the Health section's action while `reviewDue + neverVerified`
  is over zero; while `remindedThisWeek(remindedAt, now)` it is "Owners reminded 14 Nov". Each press is `run` under
  `ask:<id>` or `remind-owners` (the button's busy look, one at a time), then `toast.info(emailResultText(result,
kind, now))` and the overview read again; a thrown request is `emailFailureText` in the error callout.
- **Questions.** `askedByText`: "Asked once" or "Asked N times", then "by people" and "the <agent>" for each agent
  that asked, joined with commas and "and". Draft a Page is `useDraftPage(session, hasKey)` (ask-ui.md "Pages made
  here"); the row stays until dismissed (`apiDismissKnowledgeQuestion`).
- **Suggestions.** `suggestionLines`: `before` as removed lines (none for an `append`) and `after` as added lines,
  empty lines left out. A removed line is a `del` with "−", a strike and a rose tint; an added line an `ins` with
  "+" and an emerald tint; each also carries a visually hidden "Removed:" or "Added:". Accept is
  `POST suggestions/<id>/accept`, Dismiss `POST suggestions/<id>/dismiss` (`suggestions-api.ts`, written beside the
  wire types because `lib/api/knowledge.ts` has no function for either; they belong there). `suggestion_stale`
  (409) says the page has changed since.
- **Health.** `healthParts`: three parts in order. The bar is a flex row with a 1px gap; a part with pages grows by
  its count and is 4px wide at least; a part with none is not drawn. Fills: `brand-700`, `amber-400`, `slate-300`
  (dark theme: `brand-300`, `amber-500`, `slate-600`). The bar is `role="img"` with "Of 64 pages: 59 verified, 3
  review due, 2 never verified."; the legend repeats the three as swatch, name and count.
- **Always in Context.** The budget is a `progressbar` (`aria-valuetext` "4,410 of 8,000 tokens"), amber when over.
  Add a Page opens `PagePickerDialog`; a page already in is listed dimmed with "Already In". Add and remove are
  `apiSetPageKnowledge(..., { context })`. Over the budget the route answers 409 `context_budget` and the callout
  says `contextBudgetText`: "This page is 4,000 tokens and 4,410 of 8,000 are in use. Take another page out of
  Always in Context first." The page tree's own Always in Context mark follows the room's `tab-meta` patch.
- **What an Agent Sees.** `agentSample(overview, now)`: a `search_knowledge("<title>")` line, then the page, its
  trust and a passage. From the first conflict's first side when there is one (a real passage, cut at 220
  characters); else a real title with a made-up passage; else all made up. Drawn in a `pre`, dark in both themes.

## States

Loading: the dashboard's shape in placeholders (six tiles, a wide and a narrow card) in a `status` named "Loading AI
Knowledge". Failed: an error callout, **Try Again**. Offline: one `EmptyState` for the view. Ready: the dashboard.

## Share roles

| Action                                                             | Editor | Participant | Viewer |
| ------------------------------------------------------------------ | ------ | ----------- | ------ |
| See every section, open a page, Connect an Agent, open AI Settings | yes    | yes         | yes    |
| Is Right, Fix the Other; Not a Conflict                            | yes    | yes         | no     |
| Draft a Page; dismiss a question                                   | yes    | yes         | no     |
| Accept or dismiss a suggestion                                     | yes    | yes         | no     |
| Add a page to Always in Context, or take one out                   | yes    | yes         | no     |
| Allow Writing; Stop Writing                                        | yes    | no          | no     |
| Ask Both Owners; Remind the Owners (signed in)                     | yes    | yes         | no     |

Gated on `askRights` (`resolve`, `makePages`, `context`, `manageAi`, `grantAgents`, `emailOwners`): without the flag the control is not drawn, and
each handler checks it again. Tests, a role at a time: `components/ai-knowledge/AiKnowledgeView.test.tsx` "as edit",
"as participate", "as view".

## Telemetry

`UI·Opened·ConnectAgent`; `UI·Used·AgentWriteAllowed`, `AgentWriteStopped`, `OwnersAsked`, `OwnersReminded`, `ConflictDismissed`, `QuestionDismissed`, `SuggestionAccepted`,
`SuggestionDismissed`; `UI·Added·ContextPage`, `UI·Removed·ContextPage`. No words, names or ids.

## Tests

`lib/knowledge-ask/overview-words.test.ts`, `lib/knowledge-ask/dashboard-figures.test.ts` and
`components/ai-knowledge/AiKnowledgeView.test.tsx`: one read on open and one after an action, every empty state, a
failed read, Offline, each card's rows, the passages and lines as text, the health bar's label and parts, the
over-budget refusal, each action's request, and the controls per role. `components/ai-knowledge/AiDashboard.test.tsx`:
each tile's figure and name, the amber mark, a filter tile pressing and unpressing, a tile scrolling to its card, the
sparkline's label, the caps and Show All, Most Read's rows and empty state. The api's `knowledge-ask-routes.test.ts`
"AI Knowledge" and `knowledge-overview-reads.test.ts`: the days filled with zeros, people and agents apart, the
14-day window, Most Read's order, its cap and a deleted page left out.

## AI Context on a page

Derived from [AI Knowledge](../ai-knowledge.md) "AI Context on a page": a section of the page's right rail, drawn
after Page Health in `PageRailBody` (docked and in the Page Info card alike), over Page Health's own read.

| Piece                           | File                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------- |
| the statements and their bounds | `packages/knowledge/src/sql/page-answers.ts`; `countPageAgentReads` in `reads.ts` |
| the table (schema step V19)     | `apps/api/src/knowledge/page-answers.ts` (`pageAnswersSchemaStep`)                |
| recording                       | `apps/api/src/routes/knowledge-ask-route.ts`                                      |
| the read                        | `handlePageHealth`, `apps/api/src/routes/knowledge-page-routes.ts`                |
| the section                     | `apps/editor/components/knowledge/PageAiContext.tsx`                              |
| Ask's waiting question          | `apps/editor/lib/knowledge-ask/ask-draft.ts`                                      |

- **The table.** `page_answers (tab TEXT, key TEXT, day TEXT, question TEXT, asked INTEGER, PRIMARY KEY (tab, key,
day))`, `day` the UTC day (`dayOf`), and a trigger that deletes a page's rows with its tab
  (`page_answers_tab_removed`), and `page_reads_tab` on `page_reads (tab, day)`, so a page's reads are a range of
  its own rows. Schema step V19, additive, `IF NOT EXISTS`.
- **Recording** (`recordPageAnswers(key, question, tabs, now)`): one `INSERT ... SELECT value FROM json_each(?)`
  upsert, a row for each distinct cited tab (12 at most, the passages Ask sends), `asked + 1` on a row already there
  and the newest words kept. The Ask route adds it to the batch that logs the answer's gaps, only when the request
  carried no earlier turns, the answer cited at least one passage and `questionKey(question)` is not empty. The
  words are trimmed, runs of space made one, cut to `PAGE_ANSWER_QUESTION_CHARS` (280).
- **Pruning** (`prunePageAnswers(now)`, in `pruneKnowledge`, the daily upkeep): rows whose day is
  `PAGE_ANSWERS_KEPT_DAYS` (30) or more back, then all but the newest `MAX_PAGE_ANSWER_ROWS` (5,000) by day.
- **The read.** `listPageAnswers(tab, now)`: the page's rows of the last 30 days grouped by key, `SUM(asked)` most
  first, then the latest day, then the key, `PAGE_ANSWERS_LISTED` (3); the words are those of the group's latest
  day. `countPageAgentReads(tab, now)`: the page's agent reads of the last 7 days by agent, most first, then by
  name, `PAGE_AGENTS_LISTED` (3). Both run beside the reads and the authors in `handlePageHealth`'s one
  `Promise.all`; each is a range of an index. The answer gains `answered: { question, asked }[]` and
  `agents: { agent, reads }[]` (`PageHealthResponse`, optional so a read held from before them is still one).
- **The section** (`PageAiContext`): a `section` named "AI Context", its `RAIL_LABEL` heading, then up to three blocks
  each under a smaller label, no card and no border:
  - **Always in Context**: a glyph, "Always in Context" and "About 1,200 tokens" (`tokens` from the read; nothing
    before it), and for an Editor (`rights.editFields`) a `Switch` (`sm`) labelled "Always in Context" calling
    `setFields(pageId, { context }, 'context')`, which shows the change at once and puts it back with the route's
    budget words in a toast on a refusal. Anyone else reads "Handed to Every Agent First" or "Not Handed to Agents
    First". Telemetry `UI·Added·ContextPage` / `UI·Removed·ContextPage`, as AI Knowledge sends.
  - **Answered From This Page**: up to three quotes (an opening curly quote in the brand's colour, then the
    question, clamped to three lines with the whole words still in the page for a screen reader) with "Asked once" or "Asked 6 times" under each; before the read, quiet
    placeholder lines; with none, the block is not drawn.
  - **Read by Agents**: each agent's name and its reads ("12 reads"); with none, the block is not drawn.
- **Offline**: `PageRailBody` does not draw the section.
- **Share roles**: every role sees it; only `rights.editFields` draws the switch (an Editor or a Participant on the
  whole knowledgebase, not Offline).
- **Performance**: no request of its own; one statement per answer; the rail renders it from the store slice Page
  Health already reads.
- **Tests.** `packages/knowledge/src/sql/page-answers.test.ts` (recording, grouping, the 30-day window, the cap,
  the agents' order); `apps/api/src/routes/knowledge-ai-context.test.ts` (recorded by an answer and not by a
  follow-up or an uncited one, every reading role, pruning, a deleted page); `PageAiContext.test.tsx` (per role,
  hidden empty blocks, the switch); `e2e/signed-in/ai-context.spec.ts` (an asked question shows under
  Answered From This Page).

## Page Insights

Derived from [AI Knowledge](../ai-knowledge.md#page-insights): `components/knowledge/PageInsights.tsx`, drawn in
`PageRailBody` before AI Context (docked, card and sheet), over Page Health's read (`health.insights`,
`health.answered`, `health.created`).

- **The wire.** `PageHealthResponse.insights?: { days: KnowledgeReadsDay[]; cited?: number }`: 30 days oldest first;
  `cited` absent through a link confined to one page (no Ask there). `reads` (the week) is now summed from the same
  rows.
- **Layout** (264 px of content): the `RAIL_LABEL` heading "Page Insights"; a line of the 30-day total (`text-2xl`
  semibold tabular) and "reads in 30 days"; the bars (`ReadsSparkline` with `tall`, 40 px, its spoken label
  `readsSparkLabel(days)`); a key of two dots (People, Agents) with their counts; then a two-cell `dl` of quiet
  figures, **Cited by Ask** ("12 times", "Once", "Not yet") and **Read by Agents** ("34 times"); then **Answered
  From This Page** (moved from `PageAiContext`, the same quotes).
- **States.** Before the read: placeholder bars of the final height. A page whose `created.at` is within
  `NEW_PAGE_INSIGHT_DAYS`: a soft panel, "New This Week" and "Reads show here as people and agents open it." (no
  reads) or `readsSoFarText` ("3 reads so far: 2 by people, 1 by an agent"); no bars, no figures. Otherwise no reads: the hairline bars and "No reads in 30 days".
  Offline: not drawn.
- **Directions considered.** A heat strip of 30 cells (a calendar) lost the people and agents split; two line charts
  over 30 points at 264 px were noisy and dropped small values; the stacked bars match the dashboard's sparkline and
  key, so the two tones mean the same everywhere.
- **Share roles:** every role, no control.
- **Tests:** `PageInsights.test.tsx` (the figures, the new page, no reads, a scoped link without Cited by Ask, the
  placeholder, the spoken label); `page-insights.test.ts` (`pageInsights`, `isNewPage`); the route test for `insights`
  (`knowledge-verification-off.test.ts`). An api from before Page Insights answers no `insights`: not drawn.

## Not Read in 90 Days

`components/ai-knowledge/NotReadCard.tsx`, under `MostReadCard` in the left column, from
`overview.notRead: { pages: { tab, title, touchedAt? }[]; total }` (absent from an older api: not drawn).

- An `AiSection` "Not Read in 90 Days", `count` the total, about "Pages nobody opened and no agent read in 90 days:
  worth updating, merging or deleting."; rows as Most Read's (a button a page, its title underlined on hover, a
  quiet line "Last edited 5 months ago" or "Last edit not kept", a chevron), then "4 more not listed" when the total
  passes 10. Empty: `CompactEmptyState` "Every Page Was Read".
- **Directions considered.** A switch inside Most Read (Most Read, Not Read) hid one list behind the other; a figure
  tile had no room in the band of six. Its own card keeps both lists in view.
- **Tests:** `AiDashboard.test.tsx` (rows, order kept, the count, the more line, the empty state, opening a page);
  `page-insights.test.ts` (`notReadPages`); the overview route test (`knowledge-verification-off.test.ts`: a new page
  left out, a page listed until read); `page-health-read.test.ts` (500 pages and 45,000 reads in one statement).

## Not built, or not known

Listed in the spec's "Not built". Also: the suggestion routes have been called only through a fake.
