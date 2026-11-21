# Automations item screen blueprint

Derived from [Automations](../automations.md) "Built once", on top of [ui.md](./ui.md) (the screen and its
`AutomationsKit`) and [item-engine.md](./item-engine.md) (the kinds registry). This stage builds
`@liveworkspace/automations-ui/item`: one helper that turns an app's `ItemKinds` into a whole `AutomationsKit`, for
the apps whose items have tabs and no cards (livediagram, livedocuments, livedesign, livehuddle). Everything of the
kinds every app has is drawn here once: panels, tile pictures, glyphs, the sentence, needs, values, Test Rule, Run
Rule, the Audit Trail's tab. An app's editor supplies only what is its own. liveplanner uses nothing here.

## Naming

| Word         | Means here                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------- |
| **item**     | what rules belong to; copy says the app's word, from `kinds.itemWord`                               |
| **tab**      | a tab of the item: `{ id, name }`; a run's subject                                                  |
| **view**     | `ItemView`: the open item as the editor holds it (`useItem()`)                                      |
| **outline**  | `ItemUiOutline`: the view, the names rules are worded by, what the item has, the snapshots          |
| **vignette** | a kind's picture with no stage round it: `({ tone }) => ReactNode`, drawn on a tile or a template   |
| **own**      | a kind the app registered itself (not one of `sharedTriggers`, `sharedConditions`, `sharedActions`) |

## Files

```
packages/automations-ui/
  package.json              "./item" (src/item/index.ts), "./item/plumbing" (src/item/plumbing.ts, the light half),
                            "./automation-scenes.css" (the scenes' motion, moved from liveplanner's editor)
  src/automation-scenes.css   the pictures' motion: every editor imports it
  src/item/
    index.ts                the entry: defineItemAutomationsKit, ItemTemplateScene, the panels and the types
    plumbing.ts             defineItemPlumbing, itemAutomationsWords; re-exports the client. Reaches nothing of the
                            screen: the host loads it with the editor
    client.ts               createItemAutomationsClient, ITEM_AUTOMATION_ERRORS, tabSubject
    words.ts                the tile lines, need and pick words, a run's toast and refusals (pure)
    types.ts                ItemView, ItemSnapshot, ItemTabTemplate, ItemUiOutline, ItemAutomationsKitInput
    rule-reads.ts           summarisedBefore, ruleWantsTab, itemValueGroups, triggerGroupsOf, actionGroupsOf (pure)
    once-store.ts           a list read once per item and held while the screen is open (snapshots, connections)
    outline.ts              buildOutline (pure) and makeUseItemOutline (the hook)
    kit-kinds.tsx           buildItemKinds: the registry as tiles, first forms and panels
    define-kit.tsx          defineItemAutomationsKit: the kinds, the sentence, values, templates, Test, Run, audit
    glyphs.tsx              the shared steps' icons
    panels/                 trigger-panels.tsx (EditedPanel, NotEditedPanel, TabTriggerPanel, StartsWhenPanel,
                            ItemIncomingPanel), condition-panels.tsx (TabConditionPanel, WhoConditionPanel,
                            WeekdayConditionPanel, TextConditionPanel), snapshot-panels.tsx (TakeSnapshotPanel,
                            RevertSnapshotPanel), action-panels.tsx (ItemEmailPanel, AddTabPanel, SummarisePanel),
                            panel-bits.tsx (TabSelect, the outline's reader)
    scenes/                 scene-bits.tsx (Fire, Page, Tab, TabStrip, Board, FlowLine, GlyphTile, CommentBubble,
                            CameraGlyph), trigger-scenes.tsx, action-scenes.tsx, tones.ts, ItemTemplateScene.tsx
    TabAskDialog.tsx        Which Tab? (Test Rule's and Run Rule's pick)
    ItemTestRule.tsx        the kit's Test
    ItemRunRule.tsx         the kit's Run Rule
    test/item-fixtures.tsx  tests only: a small registry (the shared kinds, one own trigger, one own action)
```

One more dependency: `@liveworkspace/api-schema` (the wire types of the routes), and `@liveworkspace/style-guards`
for the package's own guard test. The package's `sideEffects` names `*.css`, so a bundler keeps the stylesheet an
editor imports. The snapshots and the item itself
arrive through the input, so the package depends on no app and not on `@liveworkspace/snapshots`.

## The helper

`defineItemAutomationsKit(input)` answers an `AnyAutomationsKit`. Call it **once, at module level**, in a module only
the lazy screen imports: the kit must be the same object from render to render ([ui.md](./ui.md) "The kit"). Nothing
in the input may change afterwards; what changes while the screen is open arrives through `useItem()`.

```ts
/** The open item as the editor holds it. `useItem()` must answer the SAME object while nothing in it changed
 *  (memoise it on its fields): the outline, every sentence and every panel are memoised on it. */
export interface ItemView {
  id: string;
  name: string;
  tabs: readonly { id: string; name: string }[];
  /** The tab the person is on: Test Rule's and Run Rule's first choice. Null: none. */
  currentTabId: string | null;
  /** The people rules may name (Who Did It, Send Email to a person). */
  people: readonly { id: string; name: string }[];
  /** The share link the page holds, for the reads made as this person. */
  shareCode: string | null;
  signedIn: boolean;
  /** Opens a tab in the editor. The screen closes first. */
  openTab: (tabId: string) => void;
}

/** A snapshot as Revert to Snapshot lists it (`SnapshotSummary` of @liveworkspace/snapshots fits). */
export interface ItemSnapshot {
  id: string;
  name: string | null;
  createdAt: number;
  kept?: boolean;
}

/** A template Add a Tab from a Template may name. */
export interface ItemTabTemplate {
  id: string;
  name: string;
  /** A small picture beside its name (the app's template thumbnail). */
  picture?: ReactNode;
}

/** A kind's picture with no stage round it. */
export type ItemVignette = (p: { tone: ToneClasses }) => ReactNode;

export interface ItemOwnTrigger {
  scene: ItemVignette;
  /** Its fields. None: the panel says when it starts, from the kind's `line`. */
  Panel?: ComponentType<TriggerPanelProps<ItemPart, ItemUiOutline>>;
}
export interface ItemOwnCondition {
  Panel?: ComponentType<ConditionPanelProps<ItemPart, ItemUiOutline>>;
}
export interface ItemOwnAction {
  scene: ItemVignette;
  glyph: GlyphType;
  Panel?: ComponentType<ActionPanelProps<ItemPart, ItemUiOutline>>;
  /** With no Panel: what the step does, where there is nothing to set. Defaults to the kind's `line`. */
  note?: string;
}

export interface ItemAutomationsKitInput {
  /** The app's registry (`defineItemKinds`), the same value its api reads. */
  kinds: ItemKinds;
  /** The item's app, for its connections. */
  app: App;
  /** The light half (`defineItemPlumbing`): the SAME object the host was given. */
  plumbing: AutomationsPlumbing;
  /** A hook: the open item. See ItemView for what must be memoised. */
  useItem: () => ItemView;
  /** The item's snapshots, newest first, read as this person (the app's snapshots route). Asked for once per time
   *  the screen is open, and only when a Revert to Snapshot panel shows or a listed rule names a snapshot. */
  snapshots: (item: Pick<ItemView, 'id' | 'shareCode'>) => Promise<readonly ItemSnapshot[]>;
  /** The templates Add a Tab from a Template offers. Needed when `kinds.tabTemplates`. */
  tabTemplates?: readonly ItemTabTemplate[];
  /** The app's OWN kinds only, by kind: a shared kind named here throws. Every own trigger and action needs an
   *  entry (its picture); an own condition only when it has fields. */
  own?: {
    triggers?: Readonly<Record<string, ItemOwnTrigger>>;
    conditions?: Readonly<Record<string, ItemOwnCondition>>;
    actions?: Readonly<Record<string, ItemOwnAction>>;
    /** The colour of a group the app added (a kind's `group`), in the pickers. Violet otherwise. */
    tones?: Readonly<Record<string, SceneTone>>;
  };
  /** The app's ready-made rules. Each tile's picture is composed from its trigger's and its last step's
   *  (ItemTemplateScene); `scenes` draws one by hand instead, `tones` colours one. */
  templates: {
    list: readonly ItemTemplate[];
    categories: readonly { id: string; name: string }[];
    tones?: Readonly<Record<string, SceneTone>>;
    scenes?: Readonly<Record<string, ItemVignette>>;
  };
  /** Describe a Rule's example chips and the box's placeholder. */
  describe: { examples: readonly { label: string; text: string }[]; placeholder: string };
  /** The help article's button in the Rules tab's empty state ("How Rules Work"). */
  helpButton: ReactNode;
  /** The index's client, for the item's connections. */
  indexClient: IndexClient;
  /** A hook: where a guest signs in. */
  useSignInHref: () => string;
  /** The header the app's Incoming Webhook door reads a signature from. */
  signatureHeader: string;
  /** A new rule's trigger. `edited` otherwise. */
  firstTrigger?: string;
}
```

The light half, in a module that imports nothing of the screen (the host has it at first load):

```ts
export interface ItemPlumbingInput {
  itemWord: ItemWord;
  /** What a rule can do for this app, as the empty state's second sentence: "Snapshot it every Friday, tell Slack
   *  when it changes, or put a workshop board back every night." */
  examples: string;
  client: AutomationsClient;
  /** The app's own telemetry calls, written out (its emitter scan reads them). `rule_run`: Run Rule. */
  track: (event: AutomationsEvent, detail?: string) => void;
}
export function defineItemPlumbing(input: ItemPlumbingInput): AutomationsPlumbing;

export interface ItemAutomationsApi {
  /** The item's Automations address, no trailing slash: `…/<items>/<id>/automations`. */
  base: (scope: AutomationsScope) => string;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  headers: (scope: AutomationsScope, body: boolean) => Promise<HeadersInit>;
  expectOk: <T>(res: Response, action: string) => Promise<T>;
  expectOkVoid: (res: Response, action: string) => Promise<void>;
}
export function createItemAutomationsClient(api: ItemAutomationsApi): ItemAutomationsClient;
```

`./item` exports `defineItemAutomationsKit` and the types above; what it is built from, for an app's own kinds to
reuse: `buildItemKinds`, `makeUseItemOutline`, `buildOutline`, `snapshotLabel`, `itemValueGroups`,
`summarisedBefore`, `ruleWantsTab`, `triggerGroupsOf`, `actionGroupsOf`, the words (`needWords`, `pickWords`,
`goneLabel`, `runToast`, `runRefusalWords`, `startsWhen`, `tileLine`), `itemTestRule`, `ItemRunRule`, `runOffered`,
`TabAskDialog`, every panel (`TabSelect`, `EditedPanel`, `NotEditedPanel`, `TabTriggerPanel`, `startsWhenPanel`,
`ItemIncomingPanel`, `TabConditionPanel`, `WhoConditionPanel`, `WeekdayConditionPanel`, `textConditionPanel`,
`TakeSnapshotPanel`, `RevertSnapshotPanel`, `ItemEmailPanel`, `AddTabPanel`, `summarisePanel`), and the pictures
(`TRIGGER_SCENES`, `ACTION_SCENES`, `ITEM_ACTION_GLYPHS`, `ItemTemplateScene`, `TemplatePair` and the scene bits).

`createItemAutomationsClient` is `createAutomationsClient` with the refusals fixed to `AUTOMATION_ERRORS` and
`tab_not_found`, and a subject that is a tab: `POST /test` sends `AutomationTestRequest` (`{ rule, tab? }`),
`POST /:id/run` sends `AutomationRunNowRequest` (`{ tab? }`). Its answers are typed with
`@liveworkspace/api-schema/automations` over `ItemRuleBody`, `ItemListedRule` and `ItemRun`.

## What is shared and what an app adds

| Part                   | Shared (drawn here)                                                                | The app adds                                             |
| ---------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| words                  | the tool's line, the subtitle, the empty state, by item word                       | the empty state's examples                               |
| routes                 | every call, its refusals, the tab in a test and a run                              | its fetch, its headers, the base path                    |
| telemetry              | which event, when                                                                  | `track`: each event as its own call                      |
| the item               | the outline, the names, what a rule needs                                          | `useItem()`                                              |
| triggers               | names, lines, groups, pictures, panels, first forms of the shared ones             | a picture (and a panel) for each of its own              |
| conditions             | Tab, Who Did It, Day of Week, Text                                                 | a panel for one of its own that has fields               |
| steps                  | pictures, glyphs, panels of the shared ones; Wait, If / Else and the message steps | a picture, a glyph (and a panel) for each of its own     |
| sentence, needs, picks | from the registry (`itemRuleSentence`, `ruleNeeds`, `itemPicksLeft`)               | nothing: its kinds' own `words()`                        |
| values                 | the groups, from `itemValueOptions`; Webhook Field for an Incoming Webhook rule    | nothing: its registry's values                           |
| templates              | the gallery, each tile's composed picture                                          | the list, the categories; a tone or a hand-drawn picture |
| snapshots              | when the list is read, the Revert panel, Kept by a Rule                            | the read (`snapshots`)                                   |
| Test Rule, Run Rule    | the tab's pick, the result, the toast, the refusals                                | nothing                                                  |
| Audit Trail            | the Tab column, No tab, Open Tab                                                   | `useItem().openTab`                                      |

### Kinds

- **Groups** come from each kind's `group` in the registry. Pick a Trigger: Changes, Comments, People, then the
  app's own groups in the order it registered them, then Time and Other. Add an Action: Snapshots, Tabs, the app's
  own, Messages (Send Email), Timing (Wait), Other Tools (the three message steps), AI (Summarise, with "100 a day
  per <item>").
- **Tiles' lines** for the shared kinds are written here with the app's item word; an own kind's is its registry
  `line`, capitalised with a full stop.
- **A step's key** is `stepKey`: `notify_slack`, `notify_teams`, `notify_webhook`, `ai_summarise`, a kind
  otherwise. The registry's one `notify` and its `if` are never tiles: the screen draws them.
- **First forms** are the registry's `defaults()`, with what the item gives: Tab on the person's current tab, an
  Who Did It on an Editor, an email to the owner with a subject and a message, Add a Tab on the first template, a
  message step with no connection picked. From one comment trigger to another, the tab it is kept to stays.
- A registry flag carries over: `time`, `personless`, `top`, `last`, and a condition's `personal`, which the builder
  now leaves out of Add Condition (and of a condition's Condition select) under a personless trigger.
- An own trigger or action with no entry in `own`, an entry for a shared kind, and one the registry lacks each
  throw as the kit is defined: a missing picture is found at load, not on a tile.

### Panels

Every panel is built from `step-panels/panel-parts` and `@liveworkspace/ui`. A thing the rule names that the item no
longer has stays shown as "No Longer Here" until another is picked.

| Kind                                                                                                                                              | Panel                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scheduled                                                                                                                                         | stage 3's `ScheduledPanel`                                                                                                                                                                                |
| Incoming Webhook                                                                                                                                  | stage 3's `IncomingWebhookPanel`, the example body naming the item's first tab                                                                                                                            |
| Edited, Then Quiet                                                                                                                                | After (5 minutes, 15 minutes, 30 minutes, 1 hour, 4 hours, 24 hours; a rule's other figure kept as its own choice), On (Any Tab or one)                                                                   |
| Not Edited For                                                                                                                                    | Days (1 to 365), At, the time zone's line                                                                                                                                                                 |
| Comment Added, Thread Resolved, All Threads Res.                                                                                                  | On (Any Tab or one)                                                                                                                                                                                       |
| Run by Hand, Tab Added, Tab Removed, Snapshot Taken, Someone Joined, Access Requested, Action Assigned, Action Done, an own trigger with no panel | one line: "Starts when <line>." (Run by Hand also says where Run Rule is)                                                                                                                                 |
| Tab                                                                                                                                               | Match (Is one of, Is not one of), the tabs as chips                                                                                                                                                       |
| Who Did It                                                                                                                                        | Match, Roles, People                                                                                                                                                                                      |
| Day of Week                                                                                                                                       | seven day chips                                                                                                                                                                                           |
| Text                                                                                                                                              | Value (the values this trigger gives: its own first; Webhook Field and its path in an Incoming Webhook rule; "Pick a value" for one this trigger does not give), Match (Contains, Does not contain), Text |
| Take Snapshot                                                                                                                                     | Name, with Insert a Value                                                                                                                                                                                 |
| Revert to Snapshot                                                                                                                                | Snapshot (by name, else by when it was taken), a warning Callout, the empty and failed states                                                                                                             |
| Send Email                                                                                                                                        | stage 3's `EmailPanel`: To (the owner, whoever started it, a person, Email Addresses)                                                                                                                     |
| Add a Tab from a Template                                                                                                                         | Template (the picked one's picture under it), Name with Insert a Value                                                                                                                                    |
| Summarise with AI                                                                                                                                 | Read (the run's tab, where the trigger is about one; the whole item; one tab), the `{{summary}}` note                                                                                                     |
| Wait, the message steps, If / Else                                                                                                                | stage 3's                                                                                                                                                                                                 |

Revert to Snapshot says, plainly: everyone's work since the snapshot is replaced; a safety snapshot is taken first;
the snapshot is kept while a rule names it. With no snapshot in the item: "No snapshots yet", "Take a snapshot
first, in History. Then pick it here."

### Pictures

Each shared trigger and step has a **vignette** in `scenes/`, drawn from `scene-parts` and `tile-picker/tile-scene`
(tones, `PANEL`, `at`, `after`) and moved by `automation-scenes.css`: it rests on the moment before and plays on
hover or focus of its tile; with no hover, reduced motion or the editor's Reduce motion it shows the played moment,
still. No timers, no script: CSS transitions on transform and opacity alone. On a tile it stands on `TileStage` in
its group's tone.

`ItemTemplateScene` composes a template's picture: its trigger's vignette, a flow line, its last step's vignette, on
stage 3's `TemplateScene` frame; the step's half plays a beat after the trigger's (`.ats-late`). The trigger and the
last step are read by building the template once over an empty item, kept per template. `templates.scenes[id]`
replaces the composed picture; `templates.tones[id]` colours it (the trigger's group tone otherwise).

### Sentence, needs, picks

- `sentence.rule` is `itemRuleSentence(rule, kinds, outline.names)`; a condition and a step are `conditionWords` and
  `stepWords` as text. `outline.names` holds the tabs and people, the templates, and the snapshots and connections
  once read (before that a revert reads by the name the step kept).
- **Needs** are worked out in the browser: `ruleNeeds(rule, outline.have)` over the item's tabs and people, the tab
  templates, and the snapshots and connections once read (`kit.sentence.attention`, a kit member this stage adds).
  The api's own `attention` checks tabs, people and snapshots, never connections or templates, so the row shows
  the browser's reading in its place. Said without ids: "A tab is gone · Pick a snapshot".
  `needLine` is the same need for agents, by id; the UI's words are `needWords`. The footer's amber dot still
  reads a paused rule alone, as stage 3 left it.
- `picksLeft` is `itemPicksLeft`; a pick reads "Pick a snapshot".

### Values

`itemValueGroups(kinds, { trigger, afterAi })` groups `itemValueOptions`: the item ("Document"), the tab, This
Trigger (a value with `under`), Who and When (`person`, `rule`, `now`, `now.date`), AI (`summary`). An Incoming
Webhook rule's end with `WEBHOOK_VALUE_GROUP`. `afterAi` is whether a Summarise step stands before the step whose
field is open (`summarisedBefore(body, step)`; an action inside an If / Else counts from the If). The open step
reaches `kit.values` as `place.step`, which this stage adds to stage 3 (`PanelOutlineProvider`'s `step`).

### Test Rule and Run Rule

- **Test Rule** (`ItemTestRule`): a rule whose trigger is `tabbed` asks **Which Tab?** first, on the person's
  current tab, then shows `TestRuleResult` with the tab's name under the title and **Another Tab**. Any other rule
  runs at once (`TestRuleDialog`). An item with no tab says so.
- **Run Rule** (`ItemRunRule`, behind the kit's new `runRule`): a Run by Hand rule that is on shows **Run Rule** on
  its row (a button with a tooltip) and in its ⋯ menu. It asks Which Tab? only when the rule reads the run's tab
  (`ruleWantsTab`: a Tab condition, a step on the run's tab, a `{{tab.…}}` value). Then a toast: "Ran “<rule>”"
  (up to its Wait, when one holds it), the run's reason when it failed or was skipped, the refusal's words when the
  api refused (`automation_budget_spent`: "This <item> has used today’s 1,000 runs. It runs again tomorrow.").

### The Audit Trail

`audit.column` "Tab", `audit.none` "No tab", `subjectOf` the run's `subject` (its tab's id and name),
`audit.open` "Open Tab" through `useItem().openTab`.

## What stage 3 gained

Each is optional, so liveplanner's kit and screen are as they were:

| Where                               | What                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `kit.sentence.attention?`           | what a rule needs, worked out in the browser; `RuleRow` reads `rule.attention` without it                    |
| `ConditionKind.personal?`           | left out of Add Condition and the Condition select under a personless trigger                                |
| `IncomingWebhookPanel`'s `example?` | the body How to Send posts, in place of the kit's                                                            |
| `kit.runRule?`                      | `{ offered(rule), Run }`: Run Rule on a row and in its menu (`RuleRow`, `RuleMenu`, `AutomationsDialog`)     |
| `kit.values` place                  | `step?`: the step whose field is open (`PanelOutlineProvider`, `ValueTextField`)                             |
| `AutomationsEvent`                  | `rule_run`                                                                                                   |
| `refusal-words.ts`                  | `automation_budget_spent`, `automation_not_manual`, `automation_needs_a_person`, `automation_snapshots_full` |
| `scene-parts.tsx`, the allowlist    | the lint disable went: the file is on `ICON_ART_ALLOWLIST`, with `item/scenes/**`                            |
| `automation-scenes.css`             | moved here from liveplanner's editor; `.ats-late`                                                            |
| `style-guards.test.ts`              | the editors' three style guards, now run over this package too                                               |

## Mounting Automations in an item editor

For livediagram, livedocuments, livedesign and livehuddle these replace steps 2 to 6 of [ui.md](./ui.md)'s
"Mounting the screen in an editor"; its steps 1 and 7 to 11 stand as written.

1. Add `@liveworkspace/automations-ui` to the editor, the `@source` line for its classes, and in the editor's
   stylesheet `@import '@liveworkspace/automations-ui/automation-scenes.css';` ([ui.md](./ui.md) step 1).
2. **The plumbing**, in a module that imports nothing of the screen (the host loads it):
   `createItemAutomationsClient({ base, fetch, headers, expectOk, expectOkVoid })` over the editor's own fetch and
   its `…/automations` routes, then `defineItemPlumbing({ itemWord, examples, client, track })`, `track` a switch of
   the app's own telemetry calls written out (its emitter scan reads them), `rule_run` among them. Import both from
   `@liveworkspace/automations-ui/item/plumbing`.
3. **`useItem`**, a hook in the editor answering an `ItemView`, memoised on its fields: the item's id and name, its
   tabs (`{ id, name }`), the current tab, the people rules may name, the share code, signed in, and `openTab`.
4. **The app's own kinds**, for each trigger and action its registry adds: a vignette (drawn from `scene-parts`),
   an action's glyph, and a panel where the kind has fields. Nothing for a shared kind.
5. **The kit**, a module constant in a module only the lazy screen imports:
   `export const KIT = defineItemAutomationsKit({ kinds, app, plumbing, useItem, snapshots, tabTemplates, own,
templates, describe, helpButton, indexClient, useSignInHref, signatureHeader })`. `snapshots` is the app's
   snapshots list (`snapshotsApi(deps).list()` of `@liveworkspace/snapshots/client`, its `snapshots`);
   `tabTemplates` the templates New Tab offers, where the registry has `tabTemplates`.
6. **The lazy screen**: a component taking `AutomationsScreenProps` that renders
   `<AutomationsKitProvider kit={KIT}><AutomationsDialog {...props} /></AutomationsKitProvider>`; and **the lazy
   gate**: `{ gate, onClose }` rendering `AutomationsSyncGate` with the app's Sync gate dialog, sign-in address and
   help link ([ui.md](./ui.md) steps 5 and 6, unchanged).
7. Go on with [ui.md](./ui.md) steps 7 to 11: the scope and the gate, `AutomationsHost` with the plumbing, the
   Tools row, the reader's sheet, the guards. The first-load guard must also hold that the editor's first load
   reaches `…/item/plumbing` and never `…/item`.

## Performance

- **First load.** `./item` is reached only from the app's lazy screen; `./item/plumbing` is three small files (its
  own, `client.ts`, stage 3's `automations-client.ts`), the error list of `@liveworkspace/api-schema/automations`
  and no React. `door-lazy-load.test.ts` holds both: the door reaches nothing under `item/`, and the plumbing
  reaches nothing of the screen or the kit.
- **Renders.** The kit is built once. The outline is memoised on the `ItemView`, the two read-once lists and
  nothing else, so a keystroke in a panel re-renders that panel and the step's card (the body changed), not the
  list or the pictures. A picture is static markup: no state, no effect, no timer.
- **Reads.** The snapshots are read at most once per time the screen is open, and only when a Revert to Snapshot
  panel shows or a listed rule names a snapshot. The connections are read once more for the list only when a listed
  rule names one and the person is signed in (the builder's own read, when a message step's panel opens, is stage
  3's). Both are dropped when the screen closes.
- **Size.** A template's picture builds its rule once per template, kept. Every list is the item's own (tabs,
  people, at most 5 + 5 snapshots, 10 connections, 50 rules): nothing here grows past them.

## Tests

| File                            | Covers                                                                                                                                                                                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/item/item-kit.test.tsx`    | a kit from a small registry: the screen, the sentence, building and saving each shared trigger and step (each saved body through `readItemRule`), Test Rule asking for a tab, Run Rule, the Audit Trail's tab, a rule that needs a snapshot or a connection, `{{summary}}` only after Summarise |
| `src/item/item-panels.test.tsx` | every panel: its fields, what it hands back, gone and empty states (the package has no axe run)                                                                                                                                                                                                 |
| `src/item/item-scenes.test.tsx` | every shared kind has a picture; the template picture composed and overridden                                                                                                                                                                                                                   |
| `src/item/item-pure.test.ts`    | `rule-reads.ts`, `words.ts`, `once-store.ts`, `client.ts`, `plumbing.ts`, held at 100% with `outline.ts` (its hook through the kit tests)                                                                                                                                                       |
| `style-guards.test.ts`          | optical alignment, touch targets and the motion budget, the pictures included                                                                                                                                                                                                                   |
| `src/door-lazy-load.test.ts`    | the door reaches nothing under `item/`; the plumbing reaches nothing of the screen                                                                                                                                                                                                              |
