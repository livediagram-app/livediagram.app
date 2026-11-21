# Automations blueprint

Derived from [Automations](../automations.md) and the platform's
[Automations](../../../../../liveworkspace/docs/specs/018-automations/automations.md). The engine is the platform's
(`@liveworkspace/automations`, [item-engine.md](../../../../../liveworkspace/docs/specs/018-automations/blueprints/item-engine.md));
so is almost all of the wiring ("Wiring an app" there). This blueprint is livehuddle's share: its kinds, its kit, its
call sites and its tests. livediagram's ([its blueprint](../../../../../livediagram/docs/specs/013-workspace/blueprints/automations.md))
is the same shape, and livehuddle's api is its fork; where this one is silent, livediagram's holds. The screen is
mounted in the editor ("Editor", below); livehuddle has no MCP tools or CLI verb.

## Naming

| Word          | Means here                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------ |
| **Space**     | the item rules belong to (`itemWord: 'Space'`); code and routes still say document               |
| **space**     | where Someone Arrived and Everyone Left look: one tab of the Space, as Tab Attendance counts it  |
| **visit**     | a person's stretch in a tab ([Tab attendance](../../012-collaboration/tab-attendance.md)), a row |
| **stretch**   | the run of visits that kept a tab occupied, ended by the last one leaving (gaps under the rejoin |
|               | grace bridged)                                                                                   |
| **engine**    | the room's one `ItemEngine` (`room.automations`, `env.AUTOMATIONS` inside the room)              |
| **kit**       | what the room hands the engine (`spaceKit(room)`)                                                |
| **put away**  | archived or in the Trash, as the index last said (`room.standing.putAway`)                       |
| **call site** | a place a write queues the event its rules hear                                                  |

**The space is a tab.** Arrivals and departures are read per tab, from the room's own Attendance (the same visits the
Attendance list shows). A trigger with a tab picked hears that tab; with none it hears every tab, each tab its own
space: the office filling and emptying is told tab by tab, and a Space of one tab (most Spaces) reads as the whole
Space. The Space as a whole is never one space, since a person in one tab of a campus is not in the meeting room of
another.

## Files

```
packages/document/src/automations/          @livehuddle/document/automations (pure)
  kinds.ts                                    KINDS, AUTOMATIONS_TELEMETRY_CATEGORY
  triggers.ts                                 Someone Arrived, Everyone Left, Suggestion Dropped; event kinds, data keys
  actions.ts                                  Clear the Suggestion Box
  values.ts                                   visit.people, visit.count, visit.minutes, suggestion
  templates.ts                                SPACE_TEMPLATES, TEMPLATE_CATEGORIES (the screen's, "Editor")
packages/document/src/document-envelope.ts    `document.automations` in the file; copyDocumentEnvelope answers `tabIds`
packages/templates/src/template-catalogue.ts       automationTabTemplates, automationTabTemplateNames (createAutomationTabTemplates)
packages/api-schema/src/automations.ts        the wire types, filled in with the item engine's rule and run
packages/api-schema/src/telemetry-schema.ts   the `Ran` action

apps/api/src/document-room/
  document-schema.ts                          steps 10 to 18
  document-room.ts                            `standing`, `automations`; the doors' RPC methods
  room-content-state.ts                       restoreAutomations on wake
  room-lifecycle.ts                           the alarm's due list and run; the purge
  room-rpc.ts                                 `joined` with the level, `accessRequested`; a grant's standing; a
                                              copy's `withRules`
  room-attendance.ts                          Someone Arrived and Everyone Left's two edges, beside each visit write
  document-snapshots.ts                       `kept`, the silent revert, Snapshot Taken
  document-file.ts, document-content.ts       rules in the file and in a copy
  automations/
    space-automations.ts                      the engine, the standing, the doors, wake, alarm, purge
    space-kit.ts                              spaceKit
    kit-outline.ts                            documentItemOutline, documentUrl, documentTabUrl
    kit-snapshots.ts                          kitSnapshots
    kit-text.ts                               documentText
    kit-add-tab.ts                            addTemplateTab
    kit-mail.ts                               kitMail
    kit-suggestions.ts                        Clear the Suggestion Box's runner
    visit-events.ts                           visitHearing, queueArrival, queueFilled, queueEmptied, stretchOf
    test-automation-world.ts                  tests only: one Space's real room on node:sqlite
apps/api/src/routes/
  automation-routes.ts                        /api/documents/:id/automations[/…]
  automation-hook-route.ts                    POST /api/hooks/automations/:documentId/:ruleId
  email-optout-route.ts                       POST /api/email-optout/:documentId/:token
  suggestion-routes.ts                        Suggestion Dropped, once a note lands
apps/api/src/email/email-shell.ts             automationEmailLook (and the shell templates.ts writes into)
apps/api/src/openapi/manifest.ts              the platform's operations under `documents`
apps/api/test/workerd-automations/            the room on workerd: worker.ts, wrangler.toml, automations.workerd.test.ts
```

## Kinds

`KINDS = defineItemKinds({ itemWord: 'Space', collab: false, tabTemplates: true, triggers, actions, values })`, its
own package entry so nothing that only reads a Space pulls the engine in. livehuddle has no comment threads, so
`collab` is false: no comment or action trigger, no collab watch, no `automation_collab_seen` table.

| Kind                 | Fields                                | Hears / does                                                   | Event `data`                                   |
| -------------------- | ------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------- |
| `someone_arrived`    | `tab?`, `empty` (boolean, default on) | `someone_arrived`: a visit begins in a tab (`tabbed`)          | `visit.empty`                                  |
| `everyone_left`      | `minutes` 1 to 720, `tab?`            | settles after `tab_emptied`, called off by `tab_filled`, keyed | `visit.people`, `visit.count`, `visit.minutes` |
|                      |                                       | by the tab (`tabbed`, `personless`)                            |                                                |
| `suggestion_dropped` | none                                  | `suggestion_dropped` (`personless`)                            | `suggestion`                                   |
| `clear_suggestions`  | none                                  | deletes every note in every Suggestion Box of the Space        |                                                |

- **Someone Arrived** matches when the tab is the trigger's (or it picks none) and, with `empty` on, only when the
  event's `visit.empty` is true. `empty` absent reads as on. Its words: "Someone Arrived", "on <tab>", "when it was
  empty". The run's first line: "<name> arrived in <tab>".
- **Everyone Left** is the engine's settle (item-engine.md "Kinds", `settle`): `after: ['tab_emptied']`,
  `cancel: ['tab_filled']`, `quietMs` the minutes, `key` the event's tab. So the quiet runs on the room's alarm, never
  a timer per socket; each emptying pushes the tab's row back; anyone coming back inside the window deletes it; once
  due it queues one run and its row goes, so it fires once per emptying. Its words: "Everyone Left for 10 Minutes",
  "on <tab>". The run's first line: "Everyone left <tab>".
- **Suggestion Dropped** has no `tab` pick (spec "Picks: none"); its event carries the box's tab, so `{{tab.name}}`
  reads. It is `personless`: the box is anonymous, so Who Did It is refused and an email to "whoever started it" has
  nobody. The run's first line: "A suggestion was dropped in <tab>".
- **Clear the Suggestion Box** has no field (spec "Steps of its own"): every box of the Space. Its dry run: "Would
  clear every note in the Suggestion Box". Done: "Cleared 3 notes from the Suggestion Box" (or "The Suggestion Box was
  already empty"); never fails for an empty box.
- Add a Tab from a Template is the engine's `add_tab`; its templates are `automationTabTemplates()`, the agent
  library (`templateCatalogue`), hidden ones left out, `id` the template's kind.
- Values: `visit.people`, `visit.count`, `visit.minutes` (under `everyone_left`) and `suggestion` (under
  `suggestion_dropped`), each read from the event's `data`. `{{person}}` under Someone Arrived is the arriving person.
- Every kind's `format` shows its own `"kind"` (`undescribedKinds(KINDS)` is empty, held by a test).

## Schema

Appended to `document-schema.ts` `STEPS` after step 9 (the tab folder colour, which shipped first), never edited once shipped: steps 10 to 18 are
`itemAutomationSchemaSteps({ links: 'document_tabs' })`, one entry each (the engine's rules, schedule, hooks, waiting,
drafts, fired, addresses, counts, then its `item` step: five tables and the three SQL triggers on `tabs` and `document_tabs`).
`DOCUMENT_SCHEMA_VERSION` is 18. No collab step.

## The engine in the room

As livediagram's, through the platform's holders (`ItemEngine`, `ItemStandingKeeper`), with no `CollabWatch`:

- **Made** in the constructor (`space-automations.ts` `newSpaceAutomations`): `sql` the object's SQLite, `ready`
  `room.schemaReady`, `arm` `room.armAlarm()`, `kit` `spaceKit(room)`, `putAway` `room.standing.putAway`.
  `env.AUTOMATIONS` is the same engine, for the content modules' call sites. The standing (no `collab`) is restored in
  the constructor's `blockConcurrencyWhile`, under the storage key `documentStanding`, before `restoreContentState`.
- **Restored** on wake once the schema stands (`restoreContentState` → `restoreAutomations`).
- **The alarm.** `armAlarm`'s due list gains `room.automations.schedule.wakeAt`; `alarm` runs
  `runSpaceAutomations` (`schedule.due(now)` then `runItemAutomations`) after the upkeep.
- **Put away.** The index's standing push (`routes/internal-items.ts` `standing`) reaches `room.takeStanding` first;
  `route` hands every grant to `takeGrantStanding`.
- **Purged.** After `deleteAll`: `forgetAutomations` (standing, engine, settlers).

## The kit

| Binding     | Bound to                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| `kinds`     | `KINDS`; `itemWord` `Space`; `category` `Document` (every Space event's category, telemetry.md)               |
| `outline`   | `readDocumentOutline`: name, `${APP_BASE_URL}/document/<id>`, owner, tabs, last save; people as livediagram's |
| `tabUrl`    | the Space's link with the editor's tab pin, `#t=<tabId>`                                                      |
| `snapshots` | the platform's `kitSnapshots` over `@liveworkspace/snapshots` and `documentSnapshotDoor`                      |
| `text`      | the `outline` view (`@livehuddle/document-views` `renderView`): one tab's, or every tab's under `# <name>`, a |
|             | tab at a time, stopped once `AI_SUMMARISE_TEXT_MAX` characters are held                                       |
| `addTab`    | `addTemplateTab`: `compileSeededTabs` then `upsertTab` at `nextOrderIndex`, then the `document-meta` op       |
| `mail`      | the platform's `kitMail` over `automationEmailLook` (noun `Space`); a person through `notifyActionAssigned`   |
| `sends`     | `kitSends(indexAppClient(env))`                                                                               |
| `ai`        | `aiClient(env)` and `env.AI_GATEWAY`                                                                          |
| `run`       | `clear_suggestions` (kit-suggestions.ts)                                                                      |
| `telemetry` | `reportServerEvents(env, events)`                                                                             |
| `hookUrl`   | `${APP_BASE_URL}/api/hooks/automations/<documentId>/<ruleId>`                                                 |

- **`text` never reads the Suggestion Box.** Its notes are in no tab read, API or agent read
  ([Team pieces](../../009-elements/team-pieces.md#suggestion-box)), so a summary of the Space holds the pieces' words
  and none of the notes; `{{suggestion}}` under Suggestion Dropped is the one way a rule reads a note.
- **Clear the Suggestion Box** is one `DELETE FROM suggestions WHERE document_id = ? RETURNING id` (the count), the
  rule's own write, so it starts nothing. An Editor's open box shows it on its next Refresh, as a drop does.
- **Add a Tab** fails as livediagram's: `tabLimitWords`, `TEMPLATE_GONE`, `TEMPLATE_FAILED`, `TAB_TOO_LARGE`.

## Routes

As livediagram's, the bodies the platform's (`itemAutomationPath`, `itemCallerOf`, `serveItemAutomations`,
`serveItemHook`, `serveItemOptOut`): `handleAutomationRoutes` first in `handleDocumentSubresources`; `editor` is
`gateEdit(ctx, id)` with no tab (livehuddle has no workbench); `signedIn` `ctx.verifiedUserId !== null`; `reader`
`grantOn(ctx, id) !== null`. `index.ts` answers `segments[1] === 'hooks'` and `'email-optout'` before identity.
`ROUTE_MANIFEST` spreads `itemAutomationOperations({ collection: 'documents', itemWord: 'Space' })`; the generator
roots the fifteen bodies; the manifest test adds the two segments.

## Event call sites

Each through `queueEvent(env, event)` (one Set lookup unless a rule that is on hears the kind), in the same
synchronous stretch as its write.

| Trigger            | Where                                                                               | Carries                                       |
| ------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------- |
| Tab Added          | SQL trigger; who from `asTabWriter` in `tab-put-route.ts` and `changesets/write.ts` | `by`, `role`, `data['tab.name']`              |
| Tab Removed        | SQL trigger; who from `asTabWriter` round `deleteTabRow`                            | `by`, `role` (`agent` for a token)            |
| Edited, Then Quiet | SQL trigger                                                                         |                                               |
| Snapshot Taken     | `serveDocumentSnapshots`, after a person's take answers 201                         | `by`, `role: 'editor'`                        |
| Someone Joined     | `room-rpc.ts` `joined` (the index's notice, with the link's level)                  | `by`, `role` from the level                   |
| Access Requested   | `room-rpc.ts` `accessRequested` (the index's notice, by a new RPC)                  | `by` the requester                            |
| Someone Arrived    | `room-attendance.ts` `noteAttendance`, a visit `inserted` (never `open` or          | `tab`, `by` the session's name and colour (id |
|                    | `reopened`: a reconnect inside the grace starts nothing)                            | empty), `role` its level, `visit.empty`       |
| (Everyone Left's   | the same, a join (`inserted` or `reopened`) into a tab nobody was in: `tab_filled`  | `tab`                                         |
| two edges)         | a leave that leaves the tab with no open visit: `tab_emptied`                       | `tab`, the stretch's three values             |
| Suggestion Dropped | `suggestion-routes.ts` `drop`, once the note landed                                 | `tab`, `suggestion` (500 characters); nobody  |

- **Cheap when nobody listens.** `noteAttendance` asks `hearsEvent` for its kinds once per frame that changes a tab;
  only when one is heard does it read whether the tab was empty (one indexed probe before the join, one after the
  leave), and only `tab_emptied` reads the stretch. No rule on: two Set lookups a join or a leave, nothing written.
- **The stretch** (`visit-events.ts` `stretchOf`): the tab's visits, newest leaving first, at most
  `ATTENDANCE_TAB_MAX` (500); walked back from the last leaving while each visit overlaps the stretch or leaves within
  `ATTENDANCE_REJOIN_GRACE_MS` of its start. `visit.people` are the distinct people by `person_key` in the order they
  first came, up to `VISIT_PEOPLE_MAX` (20) names joined by ", "; `visit.count` every distinct person; `visit.minutes`
  whole minutes, rounded, from the first arrival to the last leaving.
- **The room names nobody by account** (public-api-and-tokens.md §6), so Someone Arrived's `by.id` is empty, as
  livediagram's Poll Ended: Who Did It by role works, by a chosen person never matches, and an email to "whoever
  started it" has nobody to send to.
- **A rule's run is never a visitor**: a run opens no socket, and only a socket's hello, tab-focus and close write a
  visit. A session opened by an API token's ticket is a visit as Attendance counts it.
- **A knock, nudge, raised hand or bell** queues nothing.
- **A restart's sweep** (`sweepStaleAttendance`, visits a deploy left open) queues nothing: the visits ended unseen,
  and whoever reconnects within the grace carries theirs on.
- A person's revert is silent (`silently`), as a rule's. The snapshots door's `kept` is `keptSnapshots(env)`.

## Files and copies

As livediagram's: `exportDocumentFile` passes `automations: hostRulesForFile(env)`; `readDocumentFile` (not
`keepIds`) hands `copy.automations = { rules, tabs }`; `exportCopy` sets `withRules` unless the copy is made through
a share link or a Community post's link; `importDocumentCopy` appends `landedRuleStatements` (every rule off; tabs
remapped; snapshots and connections left to pick). A revert reads no rules.

## AI and telemetry

`[ai] binding = "AI"` in `wrangler.toml` and `[env.staging.ai]`; `Env.AI`, `Env.AI_GATEWAY`. `TELEMETRY_ACTIONS`
gains `Ran`; the engine's types go out under `Document·Ran`, one batch a wake. A rule's email counts as
`Email·Sent·AutomationEmail`.

## Share roles

Held by `routes/automation-routes.test.ts`, through the real gates: an Editor of the whole Space, signed in, does
everything; an Editor through a one-tab link, a Participant, a Viewer, a guest on an Editor link, a link visitor with
no identity and someone with no grant get 403 `automations_need_editor` and change nothing; a token reads, adds and
runs; a read-only token reads and is refused every write (403 `read_only_token`); a token cannot make a secret or
save a rule holding Revert to Snapshot (403 `automation_needs_a_person`); the summary answers any reader with no
address, connection or AI ask.

## Cost

As livediagram's (its blueprint "Cost" and item-engine.md "Cost"): with no rule on, a tab save pays the triggers'
probe of an empty table, every call site one Set lookup, `armAlarm` one field read. A visit write adds two Set
lookups. With a rule on: an arrival one indexed probe, a leave one probe and (Everyone Left only) one read of at most
500 rows, a note's drop one insert. Bounds: the engine's, 200 people an outline, 200 tabs for Add a Tab, 500 visits
a stretch read, 20 names, 500 characters of a note.

## Tests

| File                                                           | Holds                                                                  |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/document/src/automations/kinds.test.ts`              | the kinds, their words, values and refusals; no kind undescribed       |
| `packages/document/src/document-envelope.test.ts`              | rules in the file; `tabIds`                                            |
| `packages/templates/src/template-catalogue.automation.test.ts` | the Add a Tab list                                                     |
| `apps/api/src/routes/automation-routes.test.ts`                | the share roles                                                        |
| `apps/api/src/routes/automation-doors.test.ts`                 | the two public doors through the Worker                                |
| `…/automations/automation-events.test.ts`                      | every call site; nothing queued with no rule on; put away; purge       |
| `…/automations/automation-runs.test.ts`                        | Scheduled, the visit triggers, Clear the Suggestion Box, revert, Add a |
|                                                                | Tab, Summarise, a hook                                                 |
| `…/automations/visit-events.test.ts`                           | the stretch: order, the 20 names, the grace, the minutes               |
| `…/automations/rules-file.test.ts`                             | the file, an import, Make a Copy                                       |
| `apps/api/test/workerd-automations/`                           | the real room on workerd                                               |

The workerd test runs the real `DocumentRoom` through the platform's harness
(`@liveworkspace/automations/testing/workerd`) and its own `/attend` door (`noteAttendance` with a session's before
and after): the schema applies, a save with no rule queues nothing, a Scheduled rule runs, Someone Arrived fires once
for a burst of arrivals into an empty tab, Everyone Left fires once after its quiet window and not when someone comes
back inside it, Clear the Suggestion Box by rule, Take Snapshot and Revert to Snapshot by rule, and an Incoming
Webhook call with a good and a bad signature.

## Editor

The platform's screen mounted in the editor, as livediagram's is (its blueprint "Editor", which holds where this one
is silent), item by item of
[ui.md](../../../../../liveworkspace/docs/specs/018-automations/blueprints/ui.md) "Mounting the screen in an editor"
and [item-ui.md](../../../../../liveworkspace/docs/specs/018-automations/blueprints/item-ui.md) "Mounting Automations
in an item editor".

### Files

```
packages/document/src/automations/templates.ts   SPACE_TEMPLATES, TEMPLATE_CATEGORIES
packages/api-schema/src/telemetry-schema.ts      the `Tested` action
packages/api-schema/src/page-views.ts            `email-optout` among LIVE_ROUTE_SEGMENTS
apps/editor/components/automations/
  space-plumbing.ts              SPACE_AUTOMATIONS_CLIENT, SPACE_AUTOMATIONS_PLUMBING, trackSpaceAutomations
  space-item.ts                  SpaceItemContext, useSpaceItemView, peopleOf
  space-people.ts                lazy: useSpaceItem, the view with the Space team's joined members
  use-space-automations.ts       useSpaceAutomations: the scope, the gate, signedIn, the ItemView, the team
  SpaceAutomationsHost.tsx       AutomationsHost with the plumbing, the lazy screen and gate; provides the ItemView
  SpaceAutomationsScreen.tsx     lazy: AutomationsKitProvider + AutomationsDialog over the kit
  SpaceAutomationsGate.tsx       lazy: AutomationsSyncGate with the workbench's SyncGateDialog over SyncDocumentPrompt
  space-kit.tsx                  SPACE_AUTOMATIONS_KIT (defineItemAutomationsKit), the describe examples
  space-scenes.tsx               the own kinds' vignettes and Clear the Suggestion Box's glyph
  visit-panels.tsx               Someone Arrived's and Everyone Left's panels
apps/editor/components/dialogs/SyncDocumentPrompt.tsx  `title` and `signInHref` (Sign In in place of Sync Space)
apps/editor/components/dialogs/ShareOfflineGate.tsx    the workbench's SyncGateDialog over SyncDocumentPrompt
apps/editor/components/chrome/ChromeControls.tsx   the Tools row (useAutomationsToolsItem), after Search
apps/editor/app/document/[id]/EditorView.tsx       useSpaceAutomations, the host round the view
apps/editor/app/globals.css                        the package's `@source`, automation-scenes.css
apps/editor/app/email-optout/                      page.tsx and EmailOptOutView.tsx: EmailOptOutPage of automations-ui
apps/editor/lib/help-articles.ts                   `automations`: `tools/automations`
liveworkspace/apps/site/app/telemetry/livehuddle/  the Automations charts, sentences and template values
```

### The plumbing

`createItemAutomationsClient` over `lib/api/core` (`${API_BASE}/documents/<id>/automations`, `apiHeaders(ownerId,
{ share, body })`), then `defineItemPlumbing({ itemWord: 'Space', examples, client, track })`, examples "Reset a
workshop Space every night, tell Slack when someone arrives, or tidy a room up once everyone has left." `track` is
livediagram's table, event for event, through this editor's `track`.

### The item

As livediagram's: `useSpaceItemView` memoised on the tabs' ids and names and the people's, so an edit that gives
`tabs` a new identity answers the same view; `name` falls back to "Untitled Space". `people` is the signed-in
account alone in the editor's own view: livehuddle has no comment mentions to load the team for. The kit's
`useItem` (`useSpaceItem`, `space-people.ts`, loaded with the screen) adds the Space team's joined members:
`apiTeamMembers(ownerId, teamId)` for the team the token names (`teams`, `documentTeamId`), once each time the
screen opens (and again only if the account or team changes while it is open), through `teamMemberRows` and `peopleOf`; a failed read leaves the
account alone. A personal Space or a guest reads nothing.

### The kit

| Input          | Bound to                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------- |
| `kinds`, `app` | `KINDS`; `livehuddle`                                                                     |
| `useItem`      | `useSpaceItem`                                                                            |
| `snapshots`    | `snapshotsApi({ apiFetch, apiHeaders: apiHeaders('', …), itemUrl }).list()`'s `snapshots` |
| `tabTemplates` | `automationTabTemplates()` (`@livehuddle/templates`)                                      |
| `own.triggers` | `someone_arrived`: picture, `SomeoneArrivedPanel`; `everyone_left`: picture,              |
|                | `EveryoneLeftPanel`; `suggestion_dropped`: picture, no panel ("Starts when")              |
| `own.actions`  | `clear_suggestions`: picture, glyph, no panel (its `line`)                                |
| `own.tones`    | `Space`: orange                                                                           |
| `templates`    | `SPACE_TEMPLATES`, `TEMPLATE_CATEGORIES`; pictures composed (`ItemTemplateScene`)         |
| `describe`     | three examples and a placeholder for a Space, Reset Every Night first                     |
| `helpButton`   | `HelpArticleLink article="automations" variant="button" label="How Rules Work"`           |
| the rest       | as livediagram's: `indexClient`, `useAuthHrefs().signInHref`, `WEBHOOK_SIGNATURE_HEADER`  |

- **`SomeoneArrivedPanel`**: `TabSelect` **In** (Any Tab or one; the hint says a tab is a room, as Attendance counts
  it), then `SwitchRow` **Only When It Was Empty** over `empty` (on unless the rule says false).
- **`EveryoneLeftPanel`**: **After**, a select of `EVERYONE_LEFT_PRESETS` (1, 5, 10, 15, 30 minutes, 1, 2, 4 and 12
  hours) in `quietWords`, a figure off the list kept as its own choice, clamped to `EVERYONE_LEFT_MINUTES_MIN` to
  `_MAX`; then `TabSelect` **In**.
- No comment or action kinds: `KINDS` is `collab: false`, so the pickers hold none (`space-scenes.test.tsx`).
- Pictures from `scene-parts` and the item scene bits (`PANEL`, `Fire`, `Avatar`, `Pill`, `Chip`, `Count`), fixed
  sizes, transitions on transform and opacity alone through `at` and `after`, resting before and playing on hover or
  focus, still under reduced motion. Glyph: Lucide `brush-cleaning` (Clear the Suggestion Box).

### The door

As livediagram's, with `badges` `Sign In`, `Sync Space`, and the gate's `item` "Space". livehuddle has no workbench
frame, so `embed` is `embedMode` alone.

| Who                                     | Row                       | Opens                |
| --------------------------------------- | ------------------------- | -------------------- |
| An Editor of the whole Space, signed in | Automations…              | the screen           |
| A guest Editor                          | Automations… `Sign In`    | the gate, Sign In    |
| An Editor on a Space kept Offline       | Automations… `Sync Space` | the gate, Sync Space |
| An Editor through a one-tab link        | none                      |                      |
| A Participant, a Viewer, an embed       | none                      |                      |

### Unsubscribing

`app/email-optout/page.tsx` draws `EmailOptOutPage` with `app` `livehuddle`, `item` `space`, `param` `d`, and `send`
`sendEmailOptOut(API_BASE, …)`. `email-optout` joins `LIVE_ROUTE_SEGMENTS`.

### Performance

- **First load.** `EditorView` and `ChromeControls` reach the host, the plumbing, `space-item.ts` and the hook, and
  of the package only the door's entry, `automations-gate`, `use-automations-gate`, `automations-tools-item` and
  `item/plumbing` (`space-automations-lazy.test.ts`). The screen, the kit, the panels, the pictures, the templates
  and the team read load with the screen's chunk; the gate with its own.
- **Renders.** The `ItemView` and the scope keep their identity through an edit (`space-item.test.tsx`,
  `space-automations-roles.test.tsx`).
- **Reads.** The team's members once each time the screen opens, and never for a personal Space.

### Tests

| File                                                      | Holds                                                                |
| --------------------------------------------------------- | -------------------------------------------------------------------- |
| `packages/document/src/automations/templates.test.ts`     | the ten; each reads once picked; exactly its picks left              |
| `components/automations/space-automations-lazy.test.ts`   | the editor's first load reaches the door and `…/item/plumbing` alone |
| `components/automations/space-item.test.tsx`              | the view, its people, its identity through an edit; the team read    |
| `components/automations/space-plumbing.test.ts`           | every event's call; the routes' address                              |
| `components/automations/space-automations-roles.test.tsx` | the row by share role, each gate's dialog, the scope's identity      |
| `components/automations/space-scenes.test.tsx`            | each own kind's picture; the kit builds, with no comment kinds       |
| `components/automations/visit-panels.test.tsx`            | both panels: their fields and what they save                         |
| `lib/telemetry-coverage.test.ts`                          | the new pairs in the manifest                                        |
