# AI Knowledge UI blueprint

Derived from [AI Knowledge](../ai-knowledge.md): the knowledgebase's third view, over `GET knowledge` and the routes
its actions call ([api.md](../../015-api/api.md) "Knowledge"). It is drawn on the surface the
[Ask UI blueprint](ask-ui.md) "The three views" describes and shares its session, rights, page picker, Draft a Page
and AI Settings. **Nothing here is verified in a browser.**

| Piece                                     | File                                                                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| the read and the actions' runner          | `components/ai-knowledge/useKnowledgeOverview.ts`                                                                     |
| the view                                  | `components/ai-knowledge/AiKnowledgeView.tsx`                                                                         |
| a section's card                          | `components/ai-knowledge/AiSection.tsx`                                                                               |
| the sections                              | `AgentsSection.tsx`, `ConflictsSection.tsx`, `QuestionsSection.tsx`, `SuggestionsSection.tsx`, `HealthAndContext.tsx` |
| the words                                 | `lib/knowledge-ask/overview-words.ts`                                                                                 |
| accept and dismiss a suggestion, refusals | `lib/knowledge-ask/suggestions-api.ts`                                                                                |

## The read

`useKnowledgeOverview(who, documentId, enabled)` holds `loading`, `ready` or `failed`. It asks `apiKnowledgeOverview`
when the view mounts and each time `refresh()` is called; the effect's `AbortSignal` ends a read the view no longer
wants. A re-read that fails keeps what is on show. `enabled` is false for a knowledgebase kept Offline: no request.
There is no timer.

`run(id, action, failureText)` runs one action: a second with the same `id` while the first is out does nothing; the
ids running are `busy` (a button's busy look); a refusal becomes `failure`, said in an error callout above the
sections and cleared when the next action starts; a success calls `refresh()`. So an action costs its own request
and one read.

## The sections

Each is `AiSection`: a `section` named by its heading's words (the count sits beside them in a `CountBadge`, outside
the name), one line about it, an optional action at the right, then its rows or a `CompactEmptyState`.

| Section                       | Rows from             | Empty state                                                   | Editor's actions                                    |
| ----------------------------- | --------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| Connected Agents              | `agents`              | "No Agents Yet", Connect an Agent                             | none                                                |
| Pages That Disagree           | `conflicts`, `hasKey` | "No Disagreements Yet"; with no key, a note that it needs one | each side's Is Right, Fix the Other; Not a Conflict |
| Questions Nobody Could Answer | `questions`           | "No Unanswered Questions Yet"                                 | Draft a Page; Dismiss                               |
| Edits Suggested by Agents     | `suggestions`         | "No Suggested Edits Yet"                                      | Accept; Dismiss (Open the Page is everyone's)       |
| Knowledge Health              | `health`              | "No Pages Yet"                                                | none                                                |
| Always in Context             | `context`             | "No Pages in Context Yet"                                     | Add a Page; remove                                  |
| What an Agent Sees            | the read, or nothing  | a made-up page                                                | none                                                |

- **Agents.** `agentDoor(name)`: "MCP", "CLI" and "API Token" are the names the api counts a client under when it
  sends none; any other name is the client's own. `agentScopes`: `Reads`, and `Suggests Edits` when a waiting
  suggestion is this agent's. A top page is a button that shows Pages at that page (`openPassage`).
- **Conflicts.** Each side shows its title (a button to its page), `trustText` and the passage
  (`whitespace-pre-wrap`, six lines at most). `<A> Is Right, Fix the Other` opens B; `<B> Is Right, Fix the Other`
  opens A. Not a Conflict is `apiDismissKnowledgeConflict`.
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

Loading: three 160px placeholder cards in a `status` named "Loading AI Knowledge". Failed: an error callout, **Try
Again**. Offline: one `EmptyState` for the view. Ready: the sections, in the order above.

## Share roles

| Action                                                             | Editor | Participant | Viewer |
| ------------------------------------------------------------------ | ------ | ----------- | ------ |
| See every section, open a page, Connect an Agent, open AI Settings | yes    | yes         | yes    |
| Is Right, Fix the Other; Not a Conflict                            | yes    | no          | no     |
| Draft a Page; dismiss a question                                   | yes    | no          | no     |
| Accept or dismiss a suggestion                                     | yes    | no          | no     |
| Add a page to Always in Context, or take one out                   | yes    | no          | no     |

Gated on `askRights` (`resolve`, `makePages`, `context`, `manageAi`): without the flag the control is not drawn, and
each handler checks it again. Tests, a role at a time: `components/ai-knowledge/AiKnowledgeView.test.tsx` "as edit",
"as participate", "as view".

## Telemetry

`UI·Opened·ConnectAgent`; `UI·Used·ConflictDismissed`, `QuestionDismissed`, `SuggestionAccepted`,
`SuggestionDismissed`; `UI·Added·ContextPage`, `UI·Removed·ContextPage`. No words, names or ids.

## Tests

`lib/knowledge-ask/overview-words.test.ts` and `components/ai-knowledge/AiKnowledgeView.test.tsx`: one read on open
and one after an action, every empty state, a failed read, Offline, each section's rows, the passages and lines as
text, the health bar's label and parts, the over-budget refusal, each action's request, and the controls per role.

## Not built, or not known

Listed in the spec's "Not built". Also: the sections' layout has not been seen in a browser, and the suggestion
routes have been called only through a fake.
