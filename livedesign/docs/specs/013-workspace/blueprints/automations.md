# Automations blueprint

Derived from [Automations](../automations.md) and the platform's
[Automations](../../../../../liveworkspace/docs/specs/018-automations/automations.md). The engine is the platform's
(`@liveworkspace/automations`, [item-engine.md](../../../../../liveworkspace/docs/specs/018-automations/blueprints/item-engine.md));
so is almost all of the wiring ("Wiring an app" there). This blueprint is livedesign's share: its kinds, its kit,
its call sites and its tests. livediagram's ([its blueprint](../../../../../livediagram/docs/specs/013-workspace/blueprints/automations.md))
is the same shape; where this one is silent, livediagram's holds. The MCP tools and the CLI verb are later
stages.

## Naming

| Word          | Means here                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------- |
| **design**    | the item rules belong to (`itemWord: 'design'`); emails say "design" too                     |
| **engine**    | the room's one `ItemEngine` (`room.automations`, `env.AUTOMATIONS` inside the room)          |
| **kit**       | what the room hands the engine (`designKit(room)`)                                           |
| **put away**  | archived or in the Trash, as the index last said (`room.standing.putAway`)                   |
| **collab**    | the comment and action triggers' watch over each tab's threads (`room.collab`, `env.COLLAB`) |
| **main**      | a main component of the design's library (docs/specs/009-elements/components.md)             |
| **call site** | a place a write queues the event its rules hear                                              |

## Files

```
packages/design/src/automations/            @livedesign/design/automations (pure)
  kinds.ts                                    KINDS, AUTOMATIONS_TELEMETRY_CATEGORY
  triggers.ts                                 Component Changed, Agent Made Changes; COMPONENT_REF; event kind, data keys
  values.ts                                   component.name
packages/design/src/design-envelope.ts        `design.automations` in the file; copyDesignEnvelope answers `tabIds`
packages/templates/src/template-catalogue.ts       automationTabTemplates, automationTabTemplateNames (createAutomationTabTemplates)
packages/api-schema/src/automations.ts        the wire types, filled in with the item engine's rule and run
packages/api-schema/src/telemetry-schema.ts   the `Ran` action

apps/api/src/design-room/
  design-schema.ts                            steps 10 to 19
  design-room.ts                              `standing`, `automations`, `collab`; the alarm; the doors' RPC methods
  design-room-content.ts                      restoreAutomations on wake; the purge
  design-room-doors.ts                        a grant's standing; `joined`, `accessRequested`; a copy's `withRules`
  design-outbox.ts                            the collab diff's call
  design-snapshots.ts                         `kept`, the silent revert, Snapshot Taken
  design-file.ts, design-content.ts           rules in the file and in a copy
  automations/
    design-automations.ts                     the engine, the collab watch, the standing, the doors, wake, alarm, purge
    design-kit.ts                             designKit; `owns` for a rule's component
    kit-outline.ts                            designItemOutline, designUrl, designTabUrl
    kit-snapshots.ts                          kitSnapshots
    kit-text.ts                               designText
    kit-add-tab.ts                            addTemplateTab
    kit-mail.ts                               kitMail
    component-events.ts                       Component Changed and a token's Agent Made Changes, queued
    test-automation-world.ts                  tests only: one design's real room on node:sqlite
apps/api/src/routes/
  automation-routes.ts                        /api/designs/:id/automations[/…]
  automation-hook-route.ts                    POST /api/hooks/automations/:designId/:ruleId
  email-optout-route.ts                       POST /api/email-optout/:designId/:token
  component-routes.ts                         the Component Changed call site
apps/api/src/email/email-shell.ts             the email shell, automationEmailLook
apps/api/src/openapi/manifest.ts              the platform's operations under `designs`
apps/api/test/workerd-automations/            the room on workerd: worker.ts, wrangler.toml, automations.workerd.test.ts
```

## Kinds

`KINDS = defineItemKinds({ itemWord: 'design', collab: true, tabTemplates: true, triggers, values, ownRefs:
[COMPONENT_REF] })`, its own package entry so nothing that only reads a design pulls the engine in. livedesign has
no step of its own: Add a Tab from a Template is the engine's `add_tab`.

| Kind                | Fields                | Hears                                                                 | Event `data`                     |
| ------------------- | --------------------- | --------------------------------------------------------------------- | -------------------------------- |
| `component_changed` | `component?`, `name?` | a stored write to a main, settled 2 minutes after the last (`settle`) | `component.id`, `component.name` |
| `agent_changed`     | `tab?`                | a changeset write by a token, or a token's write to a main (`tabbed`) | none                             |

- **Component Changed** hears nothing directly (`hears: []`): its `settle` (`after: ['component_changed']`,
  `quietMs` `COMPONENT_QUIET_MS` = 120000, `key` the picked component or `''`) pushes the rule's stretch back on
  each change and queues one settled event once it is quiet, carrying the last change's `by`, `role` and `data`, so
  `{{component.name}}` is the last main changed. With a pick, only that main's changes count; `name` is the main's
  name when the rule was saved, for the words ("Component Changed for “Button”").
- `COMPONENT_REF = { field: 'component', noun: 'a component', title: 'Component' }` is the app's own reference
  (item-engine.md "References"), since `refsOf` knows tabs, snapshots and connections only: a copy, a file and a
  Describe a Rule draft leave the pick empty, `ruleLeftToPick` holds such a rule off, and the Rules list says when
  the main is gone (the kit's `owns`). A copy keeps its mains' ids, but the pick is still emptied: a copy is a new
  library that can change on its own.
- **Agent Made Changes** is the platform's `agentChangedTrigger` (shared with livediagram and livedocuments). A
  token's write to a main carries no tab, so only a rule with no tab pick hears it.
- Add a Tab from a Template's templates are `automationTabTemplates()`, the agent library (`templateCatalogue`),
  `id` the template's kind.

## Schema

Appended to `design-schema.ts` `STEPS` after step 9 (the tab folder colour, which shipped first), never edited once shipped: steps 10 to 18 are
`itemAutomationSchemaSteps({ links: 'design_tabs' })`, one entry each (the item step a function, so the migrate loop
runs a function step with the transaction's `exec`); step 19 is `COLLAB_SEEN_SCHEMA_STEP`. `DESIGN_SCHEMA_VERSION`
is 19. The snapshot store keeps making its own tables on first use (`@liveworkspace/snapshots`).

## The engine in the room

As livediagram's, through the platform's holders (`ItemEngine`, `CollabWatch`, `ItemStandingKeeper`, `watchRules`):

- **Made** in the constructor (`design-automations.ts` `newDesignAutomations`): `sql` the object's SQLite, `ready`
  `room.schemaReady`, `arm` `room.armAlarm()`, `kit` `designKit(room)`, `putAway` `room.standing.putAway`.
  `env.AUTOMATIONS` and `env.COLLAB` are the same objects, for the content modules' call sites. The standing is read
  in the constructor's `blockConcurrencyWhile`, under the storage key `designStanding`.
- **Restored** on wake once the schema stands (`restoreContentState` → `restoreAutomations`).
- **The alarm.** `armAlarm`'s due list gains `room.automations.schedule.wakeAt` and `room.collab.at`; `alarm` runs
  `room.collab.baseline(now)` before the outbox's drain and `runDesignAutomations` after the upkeep.
- **Put away.** The index's standing push (`routes/internal-items.ts` `standing`) reaches `room.takeStanding`, and
  `route` hands every grant to `takeGrantStanding`.
- **Purged.** After `deleteAll`: `forgetAutomations` (standing, engine, settlers, collab).

## The kit

| Binding     | Bound to                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `outline`   | `readDesignOutline`: name, `${APP_BASE_URL}/design/<id>`, owner, tabs, last save; people through `readParticipants` |
| `tabUrl`    | the design's link with the editor's tab pin, `#t=<tabId>`                                                           |
| `snapshots` | the platform's `kitSnapshots` over `@liveworkspace/snapshots` and the design's snapshot door                        |
| `text`      | the `pages` view (`renderView`): each page (frame) with its elements and their text; header, note, layouts dropped  |
| `addTab`    | `addTemplateTab`: `compileSeededTabs` then `upsertTab` at `nextOrderIndex`, then the `design-meta` op               |
| `mail`      | the platform's `kitMail` over `automationEmailLook`                                                                 |
| `sends`     | `kitSends(indexAppClient(env))`                                                                                     |
| `ai`        | `aiClient(env)` and `env.AI_GATEWAY`                                                                                |
| `run`       | none                                                                                                                |
| `owns`      | `component`: which of the ids the library still holds (`readComponentsById`, one read)                              |
| `telemetry` | `reportServerEvents(env, events)`                                                                                   |

- **`text`** reads one tab, or every tab under `# <name>` a tab at a time, stopped once `AI_SUMMARISE_TEXT_MAX`
  characters are held. An instance reads as the view lists it without its main's library (no library read per tab).
- **Add a Tab** fails as livediagram's: `tabLimitWords`, `TEMPLATE_GONE`, `TEMPLATE_FAILED`, `TAB_TOO_LARGE`.

## Routes

As livediagram's, the bodies the platform's (`itemAutomationPath`, `itemCallerOf`, `serveItemAutomations`,
`serveItemHook`, `serveItemOptOut`): `handleAutomationRoutes` first in `handleDesignSubresources`, refusing any path
the engine does not serve before it reads the design; `editor` is `!ctx.workbench && gateEdit(ctx, id)` with no tab;
`signedIn` `ctx.verifiedUserId !== null && !ctx.workbench`; `reader` `grantOn(ctx, id) !== null`. `index.ts` answers
`segments[1] === 'hooks'` and `'email-optout'` before identity. `ROUTE_MANIFEST` spreads
`itemAutomationOperations({ collection: 'designs', itemWord: 'design' })`, its `auth` words mapped to this api's
(`clerk` → `account`, `guest-or-clerk` → `guest-or-account`); the generator roots the fifteen bodies; the manifest
test adds the two segments.

## Event call sites

Each through `queueEvent(env, event)` (one Set lookup unless a rule that is on hears the kind), in the same
synchronous stretch as its write.

| Trigger            | Where                                                                               | Carries                                        |
| ------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------- |
| Tab Added          | SQL trigger; who from `asTabWriter` in `tab-put-route.ts` and `changesets/write.ts` | `by`, `role`, `data['tab.name']`               |
| Tab Removed        | SQL trigger; who from `asTabWriter` round the tab delete                            | `by`, `role` (`agent` for a token)             |
| Edited, Then Quiet | SQL trigger                                                                         |                                                |
| Snapshot Taken     | `serveDesignSnapshots`, after a person's take answers 201                           | `by`, `role: 'editor'`                         |
| Someone Joined     | `design-room-doors.ts` `joined`                                                     | `by`, `role` from the link's level             |
| Access Requested   | `accessRequested` (the index's notice, by RPC)                                      | `by` the requester                             |
| The comment and    | `CollabWatch.note`, from `drainOutbox`'s `collab` read: the only source, since an   | the comment's text and author; a resolve or an |
| action triggers    | action's change rides a tab save                                                    | action names nobody (the drain keeps no saver) |
| Component Changed  | `component-routes.ts` `answerStored`, after a PUT or PATCH of a main is stored      | `by`, `role`, `component.id`, `component.name` |
| Agent Made Changes | `writeChangeset` with a token (`queueAgentChanged`), and a token's write to a main  | `tab` (a changeset's), `by` the token's name,  |
|                    | (no tab)                                                                            | `role: 'agent'`                                |

- A person's revert is silent (`silently`), as a rule's: its library rewrite and its tab writes queue nothing. The
  snapshots door's `kept` is `keptSnapshots(env)`.
- Component Changed's event id is `component:<id>:<updatedAt>`, one per stored write. A revert, a copy, an import and
  a shared tab taken in write mains without the component routes, so none of them is a Component Changed.

## Files and copies

As livediagram's: the file export passes `automations: hostRulesForFile(env)`; `readDesignFile` (not `keepIds`)
hands `copy.automations = { rules, tabs }`; `exportCopy` sets `withRules` unless the copy is made through a share
link or a Community post's link; the copy's import appends `landedRuleStatements` (every rule off; tabs remapped;
snapshots, connections and components left to pick). A revert reads no rules.

## AI and telemetry

`[ai] binding = "AI"` in `wrangler.toml` and `[env.staging.ai]`; `Env.AI`, `Env.AI_GATEWAY`. `TELEMETRY_ACTIONS`
gains `Ran`; the engine's types go out under the shared `Document` category (`Document·Ran`), one batch a wake: the
dashboard's categories are every product's, and livedesign's item events already report there.

## Share roles

Held by `routes/automation-routes.test.ts`, through the real gates: an Editor of the whole design, signed in, does
everything; an Editor through a one-tab link, a Participant, a Viewer and a guest on an Editor link get 403
`automations_need_editor` and change nothing; a read-only token reads and is refused every write (403
`read_only_token`, the Worker's); a token cannot make a secret or save a rule holding Revert to Snapshot (403
`automation_needs_a_person`); the summary answers any reader with no address, connection or AI ask.

## Cost

As livediagram's (its blueprint "Cost" and item-engine.md "Cost"): with no rule on, a tab save pays the triggers'
probe of an empty table, every call site one Set lookup, the drain five Set lookups, `armAlarm` two field reads. A
write to a main adds two Set lookups (Component Changed, and Agent Made Changes for a token) and reads nothing more;
only when a rule hears one does it read the writer's name. `owns` is asked only by the Rules list, only for a rule
that picks a component: one read by id. Bounds: the engine's, 200 people an outline, 200 tabs for Add a Tab, 10 tabs
a baseline pass.

## Tests

| File                                                           | Holds                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/design/src/automations/kinds.test.ts`                | the kinds, their words, settle, values and refusals; no kind undescribed |
| `packages/design/src/design-envelope.test.ts`                  | rules in the file; `tabIds`                                              |
| `packages/templates/src/template-catalogue.automation.test.ts` | the Add a Tab list                                                       |
| `apps/api/src/routes/automation-routes.test.ts`                | the share roles                                                          |
| `apps/api/src/routes/automation-doors.test.ts`                 | the two public doors through the Worker                                  |
| `…/automations/automation-events.test.ts`                      | every call site; a Component Changed burst; nothing queued with no rule  |
| `…/automations/automation-runs.test.ts`                        | Scheduled, revert, Add a Tab, email, Summarise, a hook                   |
| `…/automations/rules-file.test.ts`                             | the file, an import, Make a Copy                                         |
| `…/automations/kit.test.ts`                                    | the outline, the text, `owns`, email to a person                         |
| `apps/api/test/workerd-automations/`                           | the real room on workerd                                                 |

The workerd test runs the real `DesignRoom` through the platform's harness
(`@liveworkspace/automations/testing/workerd`): the schema applies, a save with no rule queues nothing, a Scheduled
rule runs, a burst of Component Changed settles into one run, Take Snapshot and Revert to Snapshot by rule, and an
Incoming Webhook call with a good and a bad signature.

## Editor

The platform's screen mounted in the editor, as livediagram's is (its blueprint "Editor", which holds where this one
is silent), item by item of
[ui.md](../../../../../liveworkspace/docs/specs/018-automations/blueprints/ui.md) "Mounting the screen in an editor"
and [item-ui.md](../../../../../liveworkspace/docs/specs/018-automations/blueprints/item-ui.md) "Mounting Automations
in an item editor".

### Files

```
packages/design/src/automations/templates.ts   DESIGN_TEMPLATES, TEMPLATE_CATEGORIES
packages/api-schema/src/telemetry-schema.ts    the `Tested` action
packages/api-schema/src/page-views.ts          `email-optout` among LIVE_ROUTE_SEGMENTS
apps/live/components/automations/
  design-plumbing.ts           DESIGN_AUTOMATIONS_CLIENT, DESIGN_AUTOMATIONS_PLUMBING, trackDesignAutomations
  design-item.ts               DesignItemContext, useDesignItem, useDesignItemView, peopleOf
  use-design-automations.ts    useDesignAutomations: the scope, the gate, signedIn, the ItemView
  DesignAutomationsHost.tsx    AutomationsHost with the plumbing, the lazy screen and gate; provides the ItemView
  DesignAutomationsScreen.tsx  lazy: AutomationsKitProvider + AutomationsDialog over the kit
  DesignAutomationsGate.tsx    lazy: AutomationsSyncGate with the workbench's SyncGateDialog over SyncDesignPrompt
  design-kit.tsx               DESIGN_AUTOMATIONS_KIT (defineItemAutomationsKit), the describe examples
  design-scenes.tsx            the own triggers' vignettes
  component-panel.tsx          Component Changed's panel
  use-library-mains.ts         the library's mains, read for that panel
apps/live/components/dialogs/SyncDesignPrompt.tsx  `title` and `signInHref` (Sign In in place of Sync Design)
apps/live/components/dialogs/ShareOfflineGate.tsx  the workbench's SyncGateDialog over SyncDesignPrompt
apps/live/components/chrome/ChromeControls.tsx     the Tools row (useAutomationsToolsItem), after Search
apps/live/app/design/[id]/EditorView.tsx           useDesignAutomations, the host round the view
apps/live/app/globals.css                          the package's `@source`, automation-scenes.css
apps/live/app/email-optout/                        page.tsx and EmailOptOutView.tsx: EmailOptOutPage of automations-ui
apps/live/lib/help-articles.ts                     `automations`: `tools/automations`
liveworkspace/apps/site/app/telemetry/livedesign/  the Automations charts, sentences and template values
```

The gate's dialog is the workbench's (`@liveworkspace/workbench/components/dialogs/SyncGateDialog`), as livediagram's
and livedocuments' are: the header, the app's Sync prompt handed in as `Prompt`, and Cancel held while the sync runs.
Share's offline gate draws the same one.

### The plumbing

`createItemAutomationsClient` over `lib/api/core` (`${API_BASE}/designs/<id>/automations`, `apiHeaders(ownerId,
{ share, body })`), then `defineItemPlumbing({ itemWord: 'design', examples, client, track })`, examples "Tell Slack
when the library changes, snapshot every Friday, or email me when an agent edits." `track` is livediagram's table,
event for event, through this editor's `track`, under the shared `Document` category.

### The item

As livediagram's: `useDesignItemView` memoised on the tabs' ids and names and the people's (the account, then the
design team's joined members from `commentMentions.candidates`), so an edit that gives `tabs` a new identity answers
the same view; `name` falls back to "Untitled design".

### The kit

| Input          | Bound to                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------- |
| `kinds`, `app` | `KINDS`; `livedesign`                                                                     |
| `snapshots`    | `snapshotsApi({ apiFetch, apiHeaders: apiHeaders('', …), itemUrl }).list()`'s `snapshots` |
| `tabTemplates` | `automationTabTemplates()` (`@livedesign/templates`)                                      |
| `own.triggers` | `component_changed`: picture and `ComponentChangedPanel`; `agent_changed`: picture and    |
|                | `TabTriggerPanel`                                                                         |
| `own.tones`    | `Components`: orange                                                                      |
| `templates`    | `DESIGN_TEMPLATES`, `TEMPLATE_CATEGORIES`; pictures composed (`ItemTemplateScene`)        |
| `describe`     | three examples and a placeholder for a design                                             |
| `helpButton`   | `HelpArticleLink article="automations" variant="button" label="How Rules Work"`           |
| the rest       | as livediagram's: `indexClient`, `useAuthHrefs().signInHref`, `WEBHOOK_SIGNATURE_HEADER`  |

- **`ComponentChangedPanel`**: one `PanelSelect` **Component**: Any Component (value `*`, saved as no `component`),
  then the library's mains (`mainsOf`: unarchived by name, then archived by name as "<name> (Archived)"). Picking one
  saves `{ kind, component: id, name }`. A saved main the list lacks is "<name> (No Longer Here)"; a `component` of
  `''` (a copy's, a file's, a draft's) adds "Pick a component" first and marks the select invalid, and picking the
  placeholder saves nothing. Its hint says the rule waits for 2 quiet minutes and that a revert or a copy is no
  change. States: loading (the select disabled, the saved name shown), error (a note and **Try Again**), an empty
  library (a note under the select), and the list.
- **`useLibraryMains(item)`** reads `GET /api/designs/:id/components` as this person (`apiHeaders('', { share })`, no
  Offline record: the screen opens only for a stored design), once per panel and again only on Try Again; an answer
  for another design or attempt is dropped.
- Pictures from `scene-parts` and the item scene bits (`PANEL`, `Fire`, `Cursor`, `SparklesGlyph`), fixed sizes,
  transitions on transform and opacity alone through `at`, resting before and playing on hover or focus, still under
  reduced motion. Component Changed: a main frame wearing Lucide's `package` (the palette's components band's mark)
  whose button turns from a grey block to the tone's pill, two dashed instances following a beat later. Agent Made
  Changes: the agent's cursor dragging a block into a frame, a sparkle where it lands.

### Templates

`DESIGN_TEMPLATES` is the spec's table in its order, each `ItemTemplate` building a fresh body in the person's time
zone. Picks: `steps.0: connection` for Feedback to Slack, Tell Slack When This Changes, Library Updated and Access
Requests to Slack; `steps.1: connection` for Ready for Build; none else. Ids: `feedback-slack`, `feedback-done`,
`ready-for-build`, `slack-on-change`, `library-updated`, `snapshot-friday`, `weekly-summary`, `agent-edits`,
`still-current`, `access-slack`. Categories: `feedback` Feedback and Handoff, `loop` Stay in the Loop, `safe` Keep It
Safe, `library` Library and Agents.

### The door

As livediagram's, with `badges` `Sign In`, `Sync Design`, and the gate's `item` "Design".

| Who                                          | Row                        | Opens                 |
| -------------------------------------------- | -------------------------- | --------------------- |
| An Editor of the whole design, signed in     | Automations…               | the screen            |
| A guest Editor                               | Automations… `Sign In`     | the gate, Sign In     |
| An Editor on a design kept Offline           | Automations… `Sync Design` | the gate, Sync Design |
| An Editor through a one-tab link             | none                       |                       |
| A Participant, a Viewer, an embed, workbench | none                       |                       |

### Unsubscribing

`app/email-optout/page.tsx` draws `EmailOptOutPage` with `app` `livedesign`, `item` `design`, `param` `d`, and
`send` `sendEmailOptOut(API_BASE, …)`. `email-optout` joins `LIVE_ROUTE_SEGMENTS`.

### Performance

- **First load.** `EditorView` and `ChromeControls` reach the host, the plumbing, `design-item.ts` and the hook, and
  of the package only the door's entry, `automations-gate`, `use-automations-gate`, `automations-tools-item` and
  `item/plumbing` (`design-automations-lazy.test.ts`). The screen, the kit, the panel, the pictures and the templates
  load with the screen's chunk; the gate with its own.
- **Renders.** The `ItemView` and the scope keep their identity through an edit (`design-item.test.tsx`,
  `design-automations-roles.test.tsx`).
- **Reads.** Component Changed's panel reads the library once while it shows (the design's mains, a few kilobytes
  each), and again only on Try Again.

### Editor tests

| File                                                       | Holds                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| `packages/design/src/automations/templates.test.ts`        | the ten; each reads once picked; exactly its picks left              |
| `components/automations/design-automations-lazy.test.ts`   | the editor's first load reaches the door and `…/item/plumbing` alone |
| `components/automations/design-item.test.tsx`              | the view, its people, its identity through an edit                   |
| `components/automations/design-plumbing.test.ts`           | every event's call; the routes' address                              |
| `components/automations/design-automations-roles.test.tsx` | the row by share role, each gate's dialog, the scope's identity      |
| `components/automations/design-scenes.test.tsx`            | each own trigger's picture; the kit builds; the describe examples    |
| `components/automations/component-panel.test.tsx`          | the panel: its list, what it saves, loading, empty, failed, gone     |
| `lib/telemetry-coverage.test.ts`                           | the new pairs in the manifest                                        |

## Agents

The shared rule tools ([item-engine.md "Agents"](../../../../../liveworkspace/docs/specs/018-automations/blueprints/item-engine.md#agents))
bound in this product's agent-verbs package:

| File                                         | Holds                                                                                                                      |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `packages/agent-verbs/src/rules/index.ts`    | `RULE_PRODUCT` (`AGENT_PRODUCT`, `KINDS` from `@livedesign/design/automations`, `TEMPLATES`'s kinds and titles), `ruleRun` |
| `packages/agent-verbs/src/mcp/rule-tools.ts` | `mcpListRules`, `mcpChangeRules` (`createRuleTools`), in `MCP_TOOL_VERBS`                                                  |
| `packages/agent-verbs/src/rules/index.ts`    | also `ruleVerbs`, the `rule` verbs (`createRuleVerbs` over its addressing), in `VERBS`; `guide rules`                      |

`apps/mcp/src/rule-tools.ts` registers the two tools; `apps/cli` maps them to `rule ls` and `rule set` in its tool
names and names `rule` on the top help's last line. Tests: `packages/agent-verbs/src/verbs/rule.test.ts` (catalogue, format, listing, a
change round trip over the routes, the refusals, 100 rules within a CPU budget) and `apps/mcp/src/rule-tools.test.ts`.
