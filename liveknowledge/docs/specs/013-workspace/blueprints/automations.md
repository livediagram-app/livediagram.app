# Automations blueprint

Derived from [Automations](../automations.md) and the platform's
[Automations](../../../../../liveworkspace/docs/specs/018-automations/automations.md). The engine is the platform's
(`@liveworkspace/automations`, [item-engine.md](../../../../../liveworkspace/docs/specs/018-automations/blueprints/item-engine.md));
so is almost all of the wiring ("An app's bindings" there). This blueprint is liveknowledge's share: its kinds (the
version kinds it kept from livedocuments, and its own trust and AI Knowledge kinds), its kit, its call sites, the
screen's own panels and pictures, and its tests. livediagram's
([its blueprint](../../../../../livediagram/docs/specs/013-workspace/blueprints/automations.md)) is the same shape;
where this one is silent, livediagram's holds.

## Naming

| Word              | Means here                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| **knowledgebase** | the item rules belong to (`itemWord: 'knowledgebase'`); emails and the screen say it too       |
| **page**          | a tab, in every fixed word (`tabWordOf`, `inTabWords`); the rule JSON keeps `tab`              |
| **knowledge**     | a page's fields in `tabs.data.knowledge`: owner, verified at, review period, Always in Context |
| **engine**        | the room's one `ItemEngine` (`room.automations`, `env.AUTOMATIONS` inside the room)            |
| **kit**           | what the room hands the engine (`documentKit(room)`)                                           |
| **put away**      | archived or in the Trash, as the index last said (`room.standing.putAway`)                     |
| **collab**        | the comment and action triggers' watch over each tab's threads (`room.collab`, `env.COLLAB`)   |
| **version**       | a tab's named version (docs/specs/006-document/version-history.md), kept in the named store    |
| **call site**     | a place a write queues the event its rules hear                                                |

## Files

```
packages/document/src/automations/          @liveknowledge/document/automations (pure)
  kinds.ts                                    KINDS, AUTOMATIONS_TELEMETRY_CATEGORY
  triggers.ts                                 the trust, AI Knowledge and version triggers; event kinds, data keys
  actions.ts                                  Set the Page Owner, Clear Verification, Email the Page Owner, Always in
                                              Context, Name This Version, Restore a Version; VERSION_REF
  values.ts                                   page.owner, question, other.name, suggestion.reason, version.name
  templates.ts                                DOCUMENT_TEMPLATES (13), TEMPLATE_CATEGORIES (4)
packages/document/src/document-envelope.ts    `document.automations` in the file; copyDocumentEnvelope answers `tabIds`
packages/templates/src/template-catalogue.ts       automationTabTemplates, automationTabTemplateNames (createAutomationTabTemplates)
packages/api-schema/src/automations.ts        the wire types, filled in with the item engine's rule and run
packages/api-schema/src/telemetry-schema.ts   the `Ran` action

apps/api/src/document-room/
  document-schema.ts                          steps 21 to 30, and 35
  document-room.ts                            `standing`, `automations`, `collab`; the alarm; the doors' RPC methods
  document-room-content.ts                    restoreAutomations on wake; the purge
  document-room-doors.ts                      a grant's standing; `joined`, `accessRequested`; a copy's `withRules`
  document-outbox.ts                          the collab diff's call
  document-snapshots.ts                       `kept`, the silent revert, Snapshot Taken
  document-file.ts, document-content.ts       rules in the file and in a copy
  automations/
    document-automations.ts                   the engine, the collab watch, the standing, the doors, wake, alarm, purge
    document-kit.ts                           documentKit
    kit-outline.ts                            documentItemOutline, documentUrl, documentTabUrl
    kit-snapshots.ts                          kitSnapshots
    kit-text.ts                               documentText
    kit-add-tab.ts                            addTemplateTab
    kit-mail.ts                               kitMail
    kit-versions.ts                           the two steps' runners, `owns` for a rule's versions
    version-events.ts                         Version Named, Version Restored, Agent Made Changes queued
    knowledge-events.ts                       hearsKnowledge; Page Verified, Page Owner Changed, Unanswered Question,
                                              Pages Disagree, Agent Suggested a Change queued
    question-events.ts                        newQuestions, queueNewQuestions: a question's first asking
    review-events.ts                          queueReviewsDue: Review Due, once a review, from a baseline
    knowledge-who.ts                          routeWho: a route's caller as the engine's writer
    kit-knowledge.ts                          the four knowledge steps' runners; page.owner and the other values
    test-automation-world.ts                  tests only: one knowledgebase's real room on node:sqlite
apps/api/src/knowledge/page-fields-save.ts    savePageFields (silent write, tab-meta relay, the two events), personCanOpen
apps/api/src/knowledge/knowledge-emails.ts    the `review-email` work also runs queueReviewsDue while a rule hears it
apps/api/src/knowledge/email-marks.ts         MarkKind `rule-review`: the reviews a rule was told of
apps/api/src/versions/name-current.ts         Name This Version: the route's and the step's one path
apps/api/src/routes/
  automation-routes.ts                        /api/documents/:id/automations[/…]
  automation-hook-route.ts                    POST /api/hooks/automations/:documentId/:ruleId
  email-optout-route.ts                       POST /api/email-optout/:documentId/:token
apps/api/src/email/email-shell.ts             automationEmailLook
apps/api/src/openapi/manifest.ts              the platform's operations under `documents`
apps/api/test/workerd-automations/            the room on workerd: worker.ts, wrangler.toml, automations.workerd.test.ts
```

## Kinds

`KINDS = defineItemKinds({ itemWord: 'knowledgebase', collab: true, tabTemplates: true, triggers, actions, values,
ownRefs: [VERSION_REF] })`, its own package entry so nothing that only reads a knowledgebase pulls the engine in. The
item word makes every shared kind's fixed words say page (`inTabWords`): Page Added, Add a Page from a Template, The
Page the Rule Runs On.

| Kind                  | Fields                        | Hears / does                                                                    | Event `data`            |
| --------------------- | ----------------------------- | ------------------------------------------------------------------------------- | ----------------------- |
| `page_verified`       | `tab?`                        | someone verifies a page (`tabbed`, Trust)                                       | none                    |
| `review_due`          | `tab?`                        | a verified page's review comes due; nobody behind it (Trust)                    | none                    |
| `owner_changed`       | `tab?`                        | a page's owner set or cleared (`tabbed`, Trust)                                 | `page.owner`            |
| `question_unanswered` | none                          | a question nobody's pages answer, asked for the first time                      | `question`              |
| `pages_disagree`      | `tab?`                        | the conflict check finds two pages at odds (AI Knowledge)                       | `question`, `other.tab` |
| `suggestion_added`    | `tab?`                        | an agent suggests an edit (AI Knowledge)                                        | `suggestion.reason`     |
| `set_owner`           | `tab: 'run' \| id`, `to`      | `to` a `{ person }` or `{ trigger: true }`; fails for someone who can't open it |                         |
| `clear_verification`  | `tab: 'run' \| id`            | takes `verifiedAt` away; the owner stays                                        |                         |
| `email_owner`         | `subject`, `body`             | mails the run's page's owner; no owner fails                                    |                         |
| `context`             | `tab: 'run' \| id`, `on`      | Always in Context on or off, within the 8,000 token budget                      |                         |
| `version_named`       | `tab?`                        | a page's version named (`tabbed`)                                               | `version.name`          |
| `version_restored`    | `tab?`                        | a tab restored to an earlier version (`tabbed`)                                 | `version.name`          |
| `agent_changed`       | `tab?`                        | a changeset, or a pages or article write, by a token (`tabbed`)                 | none                    |
| `name_version`        | `tab: 'run' \| id`, `name`    | names the tab's current content; values allowed                                 |                         |
| `restore_version`     | `tab: id`, `version`, `name?` | restores the tab to one of its named versions                                   |                         |

- `VERSION_REF = { field: 'version', noun: 'a version', title: 'Version' }` is the app's own reference
  (item-engine.md "References"): a copy, a file and a Describe a Rule draft leave it empty to pick, `ruleLeftToPick`
  holds such a rule off, and the Rules list says when the version is gone (the kit's `owns`). `name` is the version's
  name when the step was saved, for the words.
- Add a Tab from a Template is the engine's `add_tab`; its templates are `automationTabTemplates()`, the agent
  library (`templateCatalogue`), hidden ones left out, `id` the template's kind.

## Schema

Appended to `document-schema.ts` `STEPS` after step 20 (the tab folder colour, which shipped first), never edited once shipped: steps 21 to 29 are
`itemAutomationSchemaSteps({ links: 'document_tabs' })`, one entry each; step 30 is `COLLAB_SEEN_SCHEMA_STEP`;
step 35 is `automationSchemaStep('wake')`: `automation_wake`, the engine's failed wakes in a row and the next try's hold-off
(steps 31 to 34 are the knowledgebase's own). `DOCUMENT_SCHEMA_VERSION` is 35.

## The engine in the room

As livediagram's, through the platform's holders (`ItemEngine`, `CollabWatch`, `ItemStandingKeeper`, `watchRules`):

- **Made** in the constructor (`apps/api/src/document-room/automations/document-automations.ts`): `sql` the object's SQLite, `ready`
  `room.schemaReady`, `arm` `room.armAlarm()`, `kit` `documentKit(room)`, `putAway` `room.standing.putAway`.
  `env.AUTOMATIONS` and `env.COLLAB` are the same objects, for the content modules' call sites. The standing is read
  in the constructor's `blockConcurrencyWhile`, under the storage key `documentStanding`, before
  `restoreContentState`.
- **Restored** on wake once the schema stands (`restoreContentState` → `restoreAutomations`).
- **The alarm.** `armAlarm`'s due list gains `room.automations.schedule.wakeAt` and `room.collab.at`; `alarm` runs
  `room.collab.baseline(now)` before the outbox's drain and `runDocumentAutomations` after the upkeep.
- **Put away.** livedocuments kept no standing in the room before: the index's standing push
  (`routes/internal-items.ts` `standing`) now reaches `room.takeStanding` first, and `route` hands every grant to
  `takeGrantStanding`.
- **Purged.** After `deleteAll`: `forgetAutomations` (standing, engine, settlers, collab).

## The kit

| Binding     | Bound to                                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `outline`   | `readDocumentOutline`: name, `${APP_BASE_URL}/document/<id>`, owner, tabs, last save; people as livediagram's                       |
| `tabUrl`    | the document's link with the editor's tab pin, `#t=<tabId>`                                                                         |
| `snapshots` | the platform's `kitSnapshots` over `@liveworkspace/snapshots` and `documentSnapshotDoor`                                            |
| `text`      | the `pages` view (`renderView`): each page's text, each article as Markdown; its header, coordinate note and layouts dropped        |
| `addTab`    | `addTemplateTab`: `compileSeededTabs` then `upsertTab` at `nextOrderIndex`, then the `document-meta` op                             |
| `mail`      | the platform's `kitMail` over `automationEmailLook`; a person through `notifyActionAssigned`                                        |
| `sends`     | `kitSends(indexAppClient(env))`                                                                                                     |
| `ai`        | `aiClient(env)` and `env.AI_GATEWAY`                                                                                                |
| `run`       | `name_version`, `restore_version` (kit-versions.ts); `set_owner`, `clear_verification`, `email_owner`, `context` (kit-knowledge.ts) |
| `values`    | `knowledgeValues`: `page.owner` read from the run's page (the owner's name, or "Nobody")                                            |
| `owns`      | `version`: which of the ids are still named versions of the document's tabs (one query per 40 ids)                                  |
| `telemetry` | `reportServerEvents(env, events)`                                                                                                   |

- **`text`** reads one tab, or every tab under `# <name>` a tab at a time, stopped once `AI_SUMMARISE_TEXT_MAX`
  characters are held. A tab with no pages (a canvas) reads by the same view, which lists its elements.
- **Name This Version** (`versions/name-current.ts` `nameCurrentVersion`, the route's own path): the tab is the run's
  (`run`; a run with no tab fails "This run has no tab to name") or the chosen one (gone: fails with `gone` the tab).
  A named version already holding the tab's revision is renamed; else at `VERSION_NAMED_MAX` (25) it fails "This tab
  has 25 named versions"; else the content is kept as a `manual` version by Automation (the rule's name), in the
  named store, or `tab_versions` when that store fails. It queues Version Named with the step's `source`, so the
  chain rules decide whether it starts a rule.
- **Restore a Version**: the version read from the tab (`getVersion`); unnamed or gone fails "The version is gone"
  with `gone: { kind: 'version', id }`; else `restoreVersion` with Automation as the author and no token, the Restore
  route's path: one changeset, the replaced content kept as a `restore` version (so it can be undone), the room's
  ops relayed. It queues Version Restored with the step's `source`. Held elements never stop it (only a token's
  restore is held); a tab that keeps changing fails "The tab kept changing".
- **`owns('version', ids)`**: the named versions of each tab the rules' restore steps name; an id no tab holds as a
  named version is gone.
- **Add a Page** fails as livediagram's Add a Tab, in page words: `tabLimitWords`, `TEMPLATE_GONE`,
  `TEMPLATE_FAILED`, `TAB_TOO_LARGE`, each through `inTabWords`.
- **The knowledge steps** write through `savePageFields`, the Page Health route's own path, so a step's change is
  silent (never an edit), relayed to everyone with the page open, and heard by the next rule only as the chain rules
  allow. Each refuses in words: a run with no page, a page gone or busy, Set the Page Owner for someone who can no
  longer open the knowledgebase or a starter with no person, Email the Page Owner for a page with no owner, Clear
  Verification for a page not verified, and Always in Context past its 8,000 token budget.

## Routes

As livediagram's, the bodies the platform's (`itemAutomationPath`, `itemCallerOf`, `serveItemAutomations`,
`serveItemHook`, `serveItemOptOut`): `handleAutomationRoutes` first in `handleDocumentSubresources`; `editor` is
`!ctx.workbench && gateEdit(ctx, id)` with no tab; `signedIn` `ctx.verifiedUserId !== null && !ctx.workbench`;
`reader` `grantOn(ctx, id) !== null`. `index.ts` answers `segments[1] === 'hooks'` and `'email-optout'` before
identity. `ROUTE_MANIFEST` spreads `itemAutomationOperations({ collection: 'documents', itemWord: 'document' })`; the
generator roots the fifteen bodies; the manifest test adds the two segments.

## Event call sites

Each through `queueEvent(env, event)` (one Set lookup unless a rule that is on hears the kind), in the same
synchronous stretch as its write.

| Trigger                  | Where                                                                                 | Carries                                       |
| ------------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------- |
| Tab Added                | SQL trigger; who from `asTabWriter` in `tab-put-route.ts` and `changesets/write.ts`   | `by`, `role`, `data['tab.name']`              |
| Tab Removed              | SQL trigger; who from `asTabWriter` round the tab delete                              | `by`, `role` (`agent` for a token)            |
| Edited, Then Quiet       | SQL trigger                                                                           |                                               |
| Snapshot Taken           | `serveDocumentSnapshots`, after a person's take answers 201                           | `by`, `role: 'editor'`                        |
| Someone Joined           | `document-room-doors.ts` `joined`                                                     | `by`, `role` from the link's level            |
| Access Requested         | `accessRequested` (the index's notice, by a new RPC)                                  | `by` the requester                            |
| The comment and          | `CollabWatch.note`, from `drainOutbox`'s `collab` read: the only source, since        | the comment's text and author; whoever alone  |
| action triggers          | an action's change rides a tab save here (no action-status route)                     | saved                                         |
| Version Named            | `versions/name-current.ts` (the route and the step) and the rename route giving a     | `tab`, `by`, `role`, `version.name`           |
|                          | name                                                                                  |                                               |
| Version Restored         | `versions/restore.ts` `restoreVersion`, once a restore changed the tab                | `tab`, `by`, `role`, `version.name`           |
| Agent Made Changes       | `writeChangeset` with a token, `submitPages`' write, and `create_page` (handleCreate) | `tab`, `by` the token's name, `role: 'agent'` |
| Page Verified            | `savePageFields` (Verify, the knowledge PUT, a step) when `verifiedAt` changes        | `tab`, `by`, `role`                           |
| Page Owner Changed       | `savePageFields` when the owner changes, Verify of an ownerless page included         | `tab`, `by`, `role`                           |
| Review Due               | the `review-email` work (`queueReviewsDue`), owed once a rule first hears it          | `tab`; nobody                                 |
| Unanswered Question      | Ask, an agent's empty search, report_gap: `newQuestions` before the log's write       | `question`, `by`, `role`                      |
| Pages Disagree           | `conflict-check.ts` after the conflicts' insert                                       | `tab`, `question`, `other.tab`                |
| Agent Suggested a Change | `knowledge-suggestion-routes.ts`, a token's suggestion only                           | `tab`, `suggestion.reason`, `by`              |

- A person's revert is silent (`silently`), as a rule's. The snapshots door's `kept` is `keptSnapshots(env)`.
- **Review Due's baseline.** The first check after a rule comes to hear it marks every page already due
  (`knowledge_email_marks`, kind `rule-review`, a baseline key `''`) and queues nothing, so a backlog never fires; a
  review queues once, its mark the page's verified time. The check runs whether review emails are on or off.
- **Comment Added** hears the margin notes' threads (the collab watch). The comments at a page's foot
  (`page_threads`) are not heard yet.
- The role of a version event is `agent` for a token, `editor` otherwise; a step's is the rule's `source`.

## Files and copies

As livediagram's: `exportDocumentFile` passes `automations: hostRulesForFile(env)`; `readDocumentFile` (not
`keepIds`) hands `copy.automations = { rules, tabs }`; `exportCopy` sets `withRules` unless the copy is made through
a share link or a Community post's link; `importDocumentCopy` appends `landedRuleStatements` (every rule off; tabs
remapped; snapshots, connections and versions left to pick). A revert reads no rules.

## AI and telemetry

`[ai] binding = "AI"` in `wrangler.toml` and `[env.staging.ai]`; `Env.AI`, `Env.AI_GATEWAY`. `TELEMETRY_ACTIONS`
gains `Ran`; the engine's types go out under `Document·Ran`, one batch a wake.

## Share roles

Held by `routes/automation-routes.test.ts`, through the real gates: an Editor of the whole document, signed in, does
everything; an Editor through a one-tab link, a Participant, a Viewer and a guest on an Editor link get 403
`automations_need_editor` and change nothing; a read-only token reads and is refused every write (403
`read_only_token`, the Worker's); a token cannot make a secret or save a rule holding Revert to Snapshot (403
`automation_needs_a_person`); the summary answers any reader with no address, connection or AI ask.

## Cost on the hot paths

The knowledgebase's own call sites sit on a Page Health save and on a logged question (Ask, an agent's search, report_gap).
With no rule on, each pays one Set lookup (`hearsKnowledge`) and reads nothing; with one, a save adds the queue's
insert and a question one indexed `SELECT key FROM questions WHERE key IN (…)` over its own keys. Measured per whole
request through the real room on node:sqlite (`knowledge-events.perf.test.ts`, M-series Mac, load average 6 to 8):

| Request                         | No rule on      | A rule on, queueing each time |
| ------------------------------- | --------------- | ----------------------------- |
| Owner change (Page Health save) | 0.82 to 0.93 ms | 0.67 to 0.75 ms               |
| report_gap (a logged question)  | 0.28 to 0.46 ms | 0.29 to 0.35 ms               |

Both within the noise; the test holds what a rule adds under 2 ms (x3 on CI). Ask's own cost is the model call; the
question check is the same one SELECT. Review Due adds no read to a save: the existing review work runs it, one pass
over the verified pages a wake, only while a rule hears it.

## Cost

As livediagram's (its blueprint "Cost" and item-engine.md "Cost"): with no rule on, a tab save pays the triggers'
probe of an empty table, every call site one Set lookup, the drain five Set lookups, `armAlarm` two field reads.
Name This Version and Restore a Version by a person add one Set lookup each. `owns` is asked only by the Rules list,
only for a rule that names a version: one query per 40 ids. Bounds: the engine's, 200 people an outline, 200 tabs
for Add a Tab, 10 tabs a baseline pass.

## Tests

| File                                                           | Holds                                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/document/src/automations/kinds.test.ts`              | the kinds, their words, values and refusals; no kind undescribed                |
| `packages/document/src/document-envelope.test.ts`              | rules in the file; `tabIds`                                                     |
| `packages/templates/src/template-catalogue.automation.test.ts` | the Add a Tab list                                                              |
| `apps/api/src/routes/automation-routes.test.ts`                | the share roles                                                                 |
| `apps/api/src/routes/automation-doors.test.ts`                 | the two public doors through the Worker                                         |
| `…/automations/automation-events.test.ts`                      | every call site; nothing queued with no rule on; put away; purge                |
| `…/automations/automation-runs.test.ts`                        | Scheduled, the two version steps, revert, Add a Tab, Summarise, a hook          |
| `…/automations/rules-file.test.ts`                             | the file, an import, Make a Copy                                                |
| `…/automations/knowledge-events.test.ts`                       | the knowledge call sites; nothing queued with no rule on; Review Due's baseline |
| `…/automations/kit-knowledge.test.ts`                          | the four knowledge steps and their refusals; `page.owner`                       |
| `…/automations/knowledge-events.perf.test.ts`                  | a save and a logged question within a CPU budget, with a rule on                |
| `apps/api/test/workerd-automations/`                           | the real room on workerd                                                        |

The workerd test runs the real `DocumentRoom` through the platform's harness
(`@liveworkspace/automations/testing/workerd`): the schema applies, a save with no rule queues nothing, a Scheduled
rule runs, Name This Version and Restore a Version by rule, Take Snapshot and Revert to Snapshot by rule, and an
Incoming Webhook call with a good and a bad signature.

## Editor

The platform's screen mounted in the editor, as livediagram's is (its blueprint "Editor", which holds where this one
is silent), item by item of
[ui.md](../../../../../liveworkspace/docs/specs/018-automations/blueprints/ui.md) "Mounting the screen in an editor"
and [item-ui.md](../../../../../liveworkspace/docs/specs/018-automations/blueprints/item-ui.md) "Mounting Automations
in an item editor".

### Files

```
packages/document/src/automations/templates.ts   DOCUMENT_TEMPLATES (13), TEMPLATE_CATEGORIES (4)
packages/api-schema/src/telemetry-schema.ts      the `Tested` action
packages/api-schema/src/page-views.ts            `email-optout` among LIVE_ROUTE_SEGMENTS
apps/editor/components/automations/
  document-plumbing.ts           DOCUMENT_AUTOMATIONS_CLIENT, DOCUMENT_AUTOMATIONS_PLUMBING, trackDocumentAutomations
  document-item.ts               DocumentItemContext, useDocumentItem, useDocumentItemView, peopleOf
  use-document-automations.ts    useDocumentAutomations: the scope, the gate, signedIn, the ItemView
  DocumentAutomationsHost.tsx    AutomationsHost with the plumbing, the lazy screen and gate; provides the ItemView
  DocumentAutomationsScreen.tsx  lazy: AutomationsKitProvider + AutomationsDialog over the kit
  DocumentAutomationsGate.tsx    lazy: AutomationsSyncGate with the workbench's SyncGateDialog over SyncDocumentPrompt
  document-kit.tsx               DOCUMENT_AUTOMATIONS_KIT (defineItemAutomationsKit), the describe examples
  document-scenes.tsx            the version kinds' vignettes and the two steps' glyphs
  knowledge-scenes.tsx           the trust and AI Knowledge kinds' vignettes and the four steps' glyphs
  knowledge-panels.tsx           RunOrPageField; Set the Page Owner's, Clear Verification's, Email the Page
                                 Owner's and Always in Context's panels
  version-panels.tsx             Name This Version's and Restore a Version's panels
  use-named-versions.ts          a tab's named versions, read for Restore a Version's panel
apps/editor/components/dialogs/SyncDocumentPrompt.tsx  `title` and `signInHref` (Sign In in place of Sync Document)
apps/editor/components/chrome/ChromeControls.tsx   the Tools row (useAutomationsToolsItem), after Search
apps/editor/app/document/[id]/EditorView.tsx       useDocumentAutomations, the host round the view
apps/editor/app/globals.css                        the package's `@source`, automation-scenes.css
apps/editor/app/email-optout/                      page.tsx and EmailOptOutView.tsx: EmailOptOutPage of automations-ui
apps/editor/lib/help-articles.ts                   `automations`: `tools/automations`
liveworkspace/apps/site/app/telemetry/liveknowledge/ the Automations charts, sentences and template values
```

The gate's dialog is the workbench's (`@liveworkspace/workbench/components/dialogs/SyncGateDialog`): the header,
the app's Sync prompt handed in as `Prompt`, and Cancel held while the sync runs. livediagram's gate draws the same
one.

### The plumbing

`createItemAutomationsClient` over `lib/api/core` (`${API_BASE}/documents/<id>/automations`, `apiHeaders(ownerId,
{ share, body })`), then `defineItemPlumbing({ itemWord: 'knowledgebase', examples, client, track })`, examples "Tell
Slack when a page is due for review, email a page's owner when an agent changes it, or post the questions nobody's
pages answer." `track` is livediagram's table, event for event, through this editor's `track`.

### The item

As livediagram's: `useDocumentItemView` memoised on the tabs' ids and names and the people's, so an edit that gives
`tabs` a new identity answers the same view; `name` falls back to "Untitled document".

### The kit

| Input          | Bound to                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------- |
| `kinds`, `app` | `KINDS`; `liveknowledge`                                                                  |
| `snapshots`    | `snapshotsApi({ apiFetch, apiHeaders: apiHeaders('', …), itemUrl }).list()`'s `snapshots` |
| `tabTemplates` | `automationTabTemplates()` (`@liveknowledge/templates`)                                   |
| `own.triggers` | the nine: a picture each, and `TabTriggerPanel` for each one about a page                 |
| `own.actions`  | the six: picture, glyph and panel each (`knowledge-panels.tsx`, `version-panels.tsx`)     |
| `own.tones`    | `Trust`: emerald, `AI Knowledge`: violet, `Versions`: orange                              |
| `templates`    | `DOCUMENT_TEMPLATES`, `TEMPLATE_CATEGORIES`; pictures composed (`ItemTemplateScene`)      |
| `describe`     | Reviews to Slack, Agent Edits, Unanswered Questions; the placeholder the first            |
| `helpButton`   | `HelpArticleLink article="automations" variant="button" label="How Rules Work"`           |
| the rest       | as livediagram's: `indexClient`, `useAuthHrefs().signInHref`, `WEBHOOK_SIGNATURE_HEADER`  |

- **`RunOrPageField`** (Name This Version and the four knowledge steps): **Page**, with **The Page the Rule Runs
  On** (`run`) offered where the trigger is `tabbed`, or kept while the step says so (then a hint says the run has
  none), and **One Page** of the knowledgebase's pages; a page gone reads "A page (No Longer Here)".
- **`NameVersionPanel`**: `RunOrPageField`, then `ValueTextField` **Name**, `STEP_NAME_MAX`, values allowed.
- **`SetOwnerPanel`**: **Owner** (Whoever Started the Rule, left out where nobody is behind the trigger unless the
  step says so, then the knowledgebase's people), then `RunOrPageField`. **`EmailOwnerPanel`**: the shared
  `EmailPanel` with the owner as its recipient, and a note where the trigger is about no page.
  **`ContextPanel`**: **Do** (Add to, Remove from Always in Context), then `RunOrPageField`.
- **`RestoreVersionPanel`**: `TabSelect` (no Any Tab, no run's tab); a new tab clears `version` and `name`. Once a
  tab is picked, `useNamedVersions(item, tab)` reads `GET /api/documents/:id/tabs/:tabId/versions` as this person
  (`apiListVersions` with owner `''`), keeps `name !== null`, newest first. States: loading ("Loading versions…",
  the select disabled), error (a note and **Try Again**), empty (CompactEmptyState "No named versions yet", "Name a
  version of this tab in Version History first. Then pick it here."), and the list; a saved version the list lacks is
  "<name> (No Longer Here)". Picking one saves `{ kind, tab, version: id, name }` (`VERSION_REF`'s field, and the
  name for the words). A read is per tab, made again only when the tab changes or on Try Again.
- Pictures from `scene-parts` and the item scene bits (`PANEL`, `Page`, `Fire`, `Chip`, `Cursor`, `SparklesGlyph`),
  fixed sizes, transitions on transform and opacity alone through `at`, resting before and playing on hover or
  focus, still under reduced motion. Glyphs: Lucide `bookmark-plus` (Name This Version) and `rotate-ccw`
  (Restore a Version).

### The door

As livediagram's, with `badges` `Sign In`, `Sync Knowledgebase`, and the gate's `item` "Knowledgebase". A
Participant (an Editor minus the Review Period, Style and Automations) has no row.

| Who                                             | Row                               | Opens                        |
| ----------------------------------------------- | --------------------------------- | ---------------------------- |
| An Editor of the whole knowledgebase, signed in | Automations…                      | the screen                   |
| A guest Editor                                  | Automations… `Sign In`            | the gate, Sign In            |
| An Editor on a knowledgebase kept Offline       | Automations… `Sync Knowledgebase` | the gate, Sync Knowledgebase |
| An Editor through a one-tab link                | none                              |                              |
| A Participant, a Viewer, an embed, workbench    | none                              |                              |

### Unsubscribing

`app/email-optout/page.tsx` draws `EmailOptOutPage` with `app` `liveknowledge`, `item` `knowledgebase`, `param` `d`, and
`send` `sendEmailOptOut(API_BASE, …)`. `email-optout` joins `LIVE_ROUTE_SEGMENTS`.

### Performance

- **First load.** `EditorView` and `ChromeControls` reach the host, the plumbing, `document-item.ts` and the hook,
  and of the package only the door's entry, `automations-gate`, `use-automations-gate`, `automations-tools-item`
  and `item/plumbing` (`document-automations-lazy.test.ts`). The screen, the kit, the panels, the pictures and the
  templates load with the screen's chunk; the gate with its own.
- **Renders.** The `ItemView` and the scope keep their identity through an edit (`document-item.test.tsx`,
  `document-automations-roles.test.tsx`).
- **Reads.** Restore a Version's panel reads one tab's versions (at most the tab's kept versions, the named among
  them at most 25) when it shows with a tab, and again only on a new tab or Try Again.

### Tests

| File                                                         | Holds                                                                |
| ------------------------------------------------------------ | -------------------------------------------------------------------- |
| `packages/document/src/automations/templates.test.ts`        | the thirteen; each reads once picked; exactly its picks left         |
| `components/automations/document-automations-lazy.test.ts`   | the editor's first load reaches the door and `…/item/plumbing` alone |
| `components/automations/document-item.test.tsx`              | the view, its people, its identity through an edit                   |
| `components/automations/document-plumbing.test.ts`           | every event's call; the routes' address                              |
| `components/automations/document-automations-roles.test.tsx` | the row by share role, each gate's dialog, the scope's identity      |
| `components/automations/document-scenes.test.tsx`            | each own kind's picture; the kit builds; the describe examples       |
| `components/automations/version-panels.test.tsx`             | both panels: their fields, what they save, loading, empty, gone      |
| `components/automations/knowledge-panels.test.tsx`           | the four knowledge panels: their fields, what they save, gone pages  |
| `lib/telemetry-coverage.test.ts`                             | the new pairs in the manifest                                        |

## Agents

The shared rule tools ([item-engine.md "Agents"](../../../../../liveworkspace/docs/specs/018-automations/blueprints/item-engine.md#agents))
bound in this product's agent-verbs package:

| File                                         | Holds                                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `packages/agent-verbs/src/rules/index.ts`    | `RULE_PRODUCT` (`AGENT_PRODUCT`, `KINDS` from `@liveknowledge/document/automations`, `TEMPLATES`'s kinds and titles), `ruleRun` |
| `packages/agent-verbs/src/mcp/rule-tools.ts` | `mcpListRules`, `mcpChangeRules` (`createRuleTools`), in `MCP_TOOL_VERBS`                                                       |
| `packages/agent-verbs/src/rules/index.ts`    | also `ruleVerbs`, the `rule` verbs (`createRuleVerbs` over its addressing), in `VERBS`; `guide rules`                           |

`apps/mcp/src/rule-tools.ts` registers the two tools; `apps/cli` maps them to `rule ls` and `rule set` in its tool
names and names `rule` on the top help's last line. Tests: `packages/agent-verbs/src/verbs/rule.test.ts` (catalogue, format, listing, a
change round trip over the routes, the refusals, 100 rules within a CPU budget) and `apps/mcp/src/rule-tools.test.ts`.
