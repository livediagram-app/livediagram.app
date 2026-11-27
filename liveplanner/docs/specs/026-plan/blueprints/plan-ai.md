# Plan AI (Work Tracker 1509)

The spec's [Plan AI](../plan-ai.md): the AI button beside Card Types, an Ask that takes instructions as well as
questions about the open Board, Sheet, Form or Dashboard tab. The api asks the model and reads its reply into words
and changes; nothing is made there. The editor makes the changes through the tab's own edit paths, so each is an edit
like the person's: undoable, synced live, held by their role and the tab's lock.

## Pure parts (packages/items/src/plan-ai.ts)

- Kinds `PLAN_AI_KINDS` (`board`, `sheet`, `form`, `dashboard`); roles `PlanAiRole` (`edit`, `participate`, `view`).
- Caps: `PLAN_AI_INSTRUCTION_MAX = 1000` (Ask's question cap), `PLAN_AI_TAB_MAX = 24000` characters of tab text,
  `PLAN_AI_TAB_NAME_MAX = 120`, `PLAN_AI_REPLY_MAX = 2000`, `PLAN_AI_CHANGES_MAX = 40`,
  `PLAN_AI_CHANGE_CHARS_MAX = 20000` (one change's JSON), `PLAN_AI_TURNS_MAX = 4` earlier turns,
  `PLAN_AI_TURN_REPLY_MAX = 1000`, `PLAN_AI_MAX_TOKENS = 3000` (on a key), `PLAN_AI_BUILT_IN_MAX_TOKENS = 1200`
  (built-in AI, whose model writes slower), `PLAN_AI_BODY_MAX = 64 KiB`.
- `PLAN_AI_OPS[kind]`: the ops a kind takes (a board `change_items`'s four, a sheet `change_sheet`'s 22, a form
  `change_form`'s nine that change the form itself, a dashboard's ten layout ops); `PLAN_AI_PARTICIPANT_OPS` (a
  board's add, set and move; a sheet's set, clear and format); `planAiOpsFor(kind, role)` (none for a Viewer).
- `planAiRequest(ask, previous?)`: the fixed system message (the data rule, the kind's task with every op's JSON
  shape and its guidance: a sort's range is the data rows alone, never a header or total row; a form never gains a
  question that repeats one; a dashboard's reply names slots and widths as people do, never twelfths; the role's rule,
  the reply rule, and on built-in AI (`ask.builtIn`) a short-reply rule: a starter sheet one set of at most 15 rows)
  and `JSON.stringify({ tabName, kind, tab, turns?, instruction, previous? })`
  as the user message; the schema `{ reply, changes }`.
- `readPlanAi(reply, ask)`: `{ draft: { reply, changes, dropped } }` or `{ refused: { path, message } }`. Words are
  cleaned with `draftText`; a change that is not an object or names an op the kind lacks is refused; one the role may
  not make, or past `PLAN_AI_CHANGES_MAX`, is dropped and counted; a change over `PLAN_AI_CHANGE_CHARS_MAX` is
  refused; empty words with no changes are refused. Linear in the reply.
- `PLAN_AI_WORDS`: every refusal's fixed words.

## The api (apps/api/src/routes/plan-ai.ts)

`POST /api/plan-ai`, body `PlanAiRequest` (`@liveplanner/api-schema` plan-ai.ts), answer `PlanAiResponse` `{ reply,
changes, dropped, provider, role }` (`dropped`: the changes `readPlanAi` left out). In order: a signed-in account (a guest `403 plan_ai_needs_account`, nobody
`sign_in_required`); the body within `PLAN_AI_BODY_MAX` and its fields within their caps (`400 plan_ai_invalid`);
`resolvePlanGrant` on `projectId` (none or trashed `403 plan_ai_no_access`), whose level is the role; the AI by Ask's
rule (`body.ai === 'built-in'`, else `ownKeyOf(personAiKey(..., teamId))`, a refused key `keyFailedResponse`); on
built-in AI Ask's day (`spendAsk`, `429 ask_built_in_limit` in `ASK_WORDS.limit`, unreadable `503`) then, with Pro on,
Ask's credit (`askCreditsOf`, `chargeAsk`, its refusal as `ai_credits_used`, `ask_by_others_limit` or
`plan_ai_unavailable`); then `askForDraft` (two asks at most, the second with the check's words), reporting
`Plan·Ran·PlanAi` for each. A model failure on a key is `keyFailedResponse`, else `503 plan_ai_unavailable`; a reply
that never read `422 plan_ai_unreadable`. It logs `[plan-ai] asked` with the answer, kind, role, asks, time, and the
changes answered and dropped; never the instruction, the tab or the reply.

## The editor (apps/editor/components/plan-ai/)

- `PlanAiButton`: one `ClusterPopoverSegment` (sparkle, name **AI**, `Open AI`) in a `ClusterStrip` of its own,
  rendered by `CanvasChrome` left of `PlanCardsClusterStrip` while the tab has a Plan kind (`usePlanTabKind`) and Zen
  is off. It toggles the `plan-ai` dock panel (`useDockPopovers`: width 416, `Plan·Opened·PlanAi`).
- `PlanAiPanel`: lazy (`useCanvasChromePanels`, `LazyPopover`), a `MovablePanel` popover with `planAiHeroArt`. A guest
  gets the sign-in state; otherwise the thread, the empty state with the kind's suggestions, a Viewer's note, the
  turns (`PlanAiTurn`) and the shared `AskComposer` with `AnswerWith` (`@liveworkspace/ask/composer`, which now also
  exports Ask's `askAiChoiceStore`, `useAskAiChoice` and `answeredBy`, so the pick is shared with Ask).
- `plan-ai-thread.ts`: a module store of turns a tab (at most 30), kept while the editor is open.
- `usePlanAiHost`: `hostInputOf(ctx, plan)` from the editor's context (the open tab, the tabs, the form and dashboard
  actions, the sheet store through `sheetStoreOf`) and the plan's card writes; `planAiRoleOf(isReadOnly,
canEditCards)`; `latest()` builds the host from the newest values.
- `plan-ai-host.ts` `planAiTabOf(input)`: a tab's kind, name, `read()` and `apply(changes)`, null on a canvas tab.
- `plan-ai-read.ts`: each kind as text (`readBoard`, `readSheet` over `readRange`, `readFormTab`, `readDashboard`),
  each cut by `withinBound` to `PLAN_AI_TAB_MAX` with a line saying what was left out. Linear in the tab.
- Appliers, each answering `PlanAiApplied` `{ lines, steps }`, stopping at the first change that can't be made:
  - `plan-ai-board.ts`: names resolved with `resolveType`, `resolveStatus`, `resolveItem` and `resolveFields`, values
    checked with `validateFields` and the type's required fields; then `addItems` (one write), `moveItems`,
    `patchItems` and `trashItems`, a step each.
  - `plan-ai-sheet.ts`: each change parsed with `sheetChange` and built with `buildSheetChange` on a copy of the tab's
    workbook, each write applied to the copy so the next reads it; the writes go to the store's `writeAll` (one step);
    charts added (`sheetChartElements`), cleared (`chartsCleared`) and moved (`chartsFollowing`) go through the
    bridge's `commitElements` (one more).
  - `plan-ai-form.ts`: each change parsed with `changeFormShape.changes.element`, made on `draftOf` with
    `applyFormChanges`, all or none; a change that makes a type, a board or a tab is refused. `changeForm` takes the
    form (one step); a new heading goes through `renameForm` (a second).
  - `plan-ai-dashboard.ts`: rows and slots by number as the layout stood before the turn, resolved to ids, then the
    layout's own edits (`insertDashboardRow`, `insertDashboardSlot`, `removeDashboardSlot`, `moveDashboardDivider`,
    `moveDashboardSlot`, `setDashboardRowHeight`, `setDashboardContent`); `changeDashboard` takes the layout (one
    step).
  - The agent verbs' refusals drop the sentence naming their next tool (`forPeople`).
  - `@liveplanner/agent-verbs/assist` exports only these pure builders and schemas, so the editor's chunk holds none of
    the verbs' api calls.
- `usePlanAiRun`: one turn at a time. It reads the tab, starts the turn (`Plan·Used·PlanAi`), posts
  (`plan-ai-client.ts`, a named refusal thrown as a `DraftRefusal` in the api's words), and on the answer, unless the
  answer's role or the editor's is a Viewer, builds the host again and makes the changes there, refusing if the tab
  changed meanwhile (`Plan·Changed·PlanAiChange` when any step was taken). Stop aborts and drops the answer. The
  turn's Undo calls the editor's `undo` once a step, only on the newest turn (`Plan·Undone·PlanAiChange`).

## Tests

- `packages/items/src/plan-ai.test.ts`: the ask, every reader path, the role's ops.
- `apps/api/src/routes/plan-ai.test.ts`: guest and nobody, access, method, each role's answer, the second ask, a reply
  that never reads, model and key failures, built-in chosen, Ask's day, Pro's credit.
- `apps/editor/components/plan-ai/*.test.ts(x)`: each kind's applier and reader, the host per kind, the run per role
  (an Editor's and a Participant's changes made, a Viewer's never), Stop, Undo, refusals, and the panel's states.
