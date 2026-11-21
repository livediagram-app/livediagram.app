# Automations screen blueprint

Derived from [Automations](../automations.md) "Built once" and "Connections". This is the stage that builds
`@liveworkspace/automations-ui` (`packages/automations-ui`): liveplanner's Automations screen and builder, moved out
with nothing of cards, GitHub or a plan's model left in them, and liveplanner's editor mounted on it. The other four
editors mount the same screen in a later stage, each with its own kit ("Mounting the screen in an editor", below).
What the screen looks like and does, state by state, is still described where it was written first:
[liveplanner's Automations spec](../../../../../liveplanner/docs/specs/026-plan/automations.md) "The Automations
screen", "The rule builder" and "The rule builder on a phone".

## Naming

| Spec term  | In the package                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| item       | `AutomationsScope.itemId`; copy takes the app's word from `kit.plumbing.words.item`                         |
| subject    | what a run is about: `kit.audit.subjectOf(run)`; copy takes `words.subject`                                 |
| connection | `ItemConnections`, the Connections tab; a message step's stored `webhook` id keeps the engine's name        |
| kind       | a trigger's or a condition's `kind`; an action's **key** (`stepKey`): its kind, `notify_<via>`, `ai_<task>` |
| kit        | `AutomationsKit`: everything of an app's own, handed to the screen once                                     |
| door       | what an editor's first load carries: the host, the Tools row, the gate's rule, the list (`src/index.ts`)    |

The package never says an app's own words (plan, card) in an identifier, a file name or copy: copy that needs one
reads the kit's.

## The package

```
packages/automations-ui/
  package.json        "." is the door (src/index.ts); every other module is its own entry (`./RuleBuilder`, `./kit`);
                      "./automation-scenes.css" is the pictures' motion, which every editor imports
  vitest.config.ts    the listed files held at 100%, the package at what its own tests measure
  style-guards.test.ts  optical alignment, touch targets and the motion budget, over src
  src/
    automation-scenes.css   the tile and template pictures' motion (.ats-*), moved here from liveplanner's editor
    item/                   the kit for an item with tabs and no cards, built from its kinds registry: item-ui.md
    index.ts                the door: AutomationsHost, the contexts, the gate's rule, useAutomationsToolsItem, the
                            client, the list, the kit's types. Imports nothing of the screen (door-lazy-load.test.ts)
    kit.ts                  AutomationsKit and its parts (below), defineAutomationsKit, TEST_RULE
    kit-context.tsx         AutomationsKitProvider, useAutomationsKit, useAutomationsOffer, the screen's context
                            (useAutomationsScreen), KeptRule, setFallbackAutomationsKit (tests)
    types.ts                RuleBody, ListedRule, ListedRun, RunLine, RuleStart; isIf, isWait, isOutgoing, isAi,
                            isHolder, stepKey
    automations-client.ts   AutomationRefusal, AutomationsApi (what an app hands in), createAutomationsClient
    use-automations.ts      the list, one per item, outside React: readAutomations, useAutomations, foldHook
    automations-gate.ts     automationsScopeFor, automationsGateFor, AUTOMATIONS_PARAM
    use-automations-gate.ts useAutomationsGate
    AutomationsContext.tsx  AutomationsTarget, AutomationsAccess, AutomationsDoor
    AutomationsHost.tsx     the host: target state, the first read, the door
    AutomationsSyncGate.tsx the gate, drawn with the app's own gate dialog
    automations-tools-item.tsx  the footer's Tools row
    glyphs.tsx              the bolt, the step tile, the icons of the steps every app has, Automation's disc
    AutomationsDialog.tsx   the screen: header, tabs, the tab's body or the builder, Discard Changes?, kept rules
    ScreenTabs.tsx          Rules · n, Audit Trail, Templates, Connections, then an app's own
    ConnectionsTab.tsx      the Connections tab over @liveworkspace/settings-ui/connections
    RulesList.tsx RuleRow.tsx RuleMenu.tsx RuleFilters.tsx RulesEmpty.tsx NewRuleMenu.tsx SentenceChips.tsx
    RunLog.tsx RunRow.tsx RunSteps.tsx RunsMeter.tsx RefreshButton.tsx run-words.ts screen-clock.ts
    TemplatesGallery.tsx TemplateScene.tsx scene-parts.tsx
    DescribeRuleDialog.tsx DraftedNote.tsx AiNote.tsx
    RuleBuilder.tsx RuleSteps.tsx StepCard.tsx StepMenu.tsx StepAddButtons.tsx StepPanel.tsx StepDrawer.tsx
    RuleDetails.tsx RuleDrawer.tsx PhoneRuleChrome.tsx rule-draft.ts rule-context.tsx refusal-words.ts
    AddActionDialog.tsx AddActionHeroArt.tsx AutomationsHeroArt.tsx
    tile-picker/TilePicker.tsx tile-picker/tile-scene.tsx    the gallery pickers' dialog and scene primitives
    ValueInsert.tsx ValueInsertMenu.tsx WebhookFieldInsert.tsx value-groups.ts
    item-connections.tsx    the item's connections as a message step picks them
    TestRule.tsx            useTestRun, TestRuleResult, TestRuleDialog (the whole test, for an app with no pick)
    RuleSummarySheet.tsx    a rule as a Participant or Viewer reads it; takes RuleSummaryKit, never the whole kit
    step-panels/            panel-parts.tsx (PanelField, PanelSelect, ChipToggles, IsNotPicker, TodayShift,
                            PanelNote, ChangeRow), ChangeTriggerField.tsx, ChangeActionField.tsx, WaitPanel.tsx,
                            OutgoingPanel.tsx, IncomingWebhookPanel.tsx, ScheduledPanel.tsx (ScheduledFields,
                            AtField, TimeZoneNote, ScheduledPanel), EmailPanel.tsx, EmailAddressesField.tsx
    test/fake-kit.tsx       tests only: the least an app hands the screen
```

Dependencies: `@liveworkspace/automations` (shapes, limits, words), `@liveworkspace/ui`, `@liveworkspace/workbench`
(Dialog, menus, toast, debug log), `@liveworkspace/settings-ui` (`./connections`), `@liveworkspace/community-ui`
(`./chip-field`), `@liveworkspace/index-client` (types), `@liveworkspace/icons`. Nothing of an app's.

## The kit

The app hands the screen one `AutomationsKit`, through `AutomationsKitProvider` at the screen's root. It must be the
same object from render to render (a module constant): every row, card and panel reads it from context. What
changes while the screen is open is read through its hooks (`useOutline`, `kinds.useOffer`, a view's `useOn`).
`defineAutomationsKit<Trigger, Condition, Step, Outline, Rule, Run, Gone>(kit)` types it in full over the app's own
closed unions and answers it as the screen holds it (`AnyAutomationsKit`: every kind open, the outline unknown).

`AutomationsPlumbing` is the light half (words, the routes, telemetry): the same object goes to `AutomationsHost`,
which loads with the editor, and into the kit as `kit.plumbing`.

```ts
// Who is asking, about which item: the routes' scope (a share link's code rides along).
export type AutomationsScope = { ownerId: string; itemId: string; shareCode: string | null };

// ---- Plumbing: what the footer's row and the host need, before the screen's code loads ------------------------------

// What the screen reports, named by what happened; the app's `track` maps each to its own telemetry call (its item
// category, written out where its emitter scan reads it). `detail`: a template's id, a new rule's trigger kind.
export type AutomationsEvent =
  | 'opened'
  | 'opened_offline'
  | 'opened_sign_in'
  | 'rule_created'
  | 'rule_on'
  | 'rule_off'
  | 'rule_deleted'
  | 'rule_tested'
  // Run Rule, from a rule's row or its menu (kit.runRule).
  | 'rule_run'
  | 'draft_created'
  | 'describe_opened'
  | 'template_opened'
  | 'secret_created'
  | 'secret_changed'
  | 'secret_copied';

export interface AutomationsWords {
  /** The item's word, lower case: "plan", "document", "design", "Space". */
  item: string;
  /** What a run is about, lower case: "card", "tab". */
  subject: string;
  /** The Tools row's line: "Rules that act on cards for you." */
  toolLine: string;
  /** The screen's line under its title. */
  subtitle: string;
  /** The Rules tab's empty state. */
  empty: string;
  /** What the builder's test is called: "Test Rule" (TEST_RULE), or the app's own ("Test on a Card"). */
  test: string;
}

/** The light half of the kit: all the footer's row, the gate and the host read. It imports nothing of the screen. */
export interface AutomationsPlumbing {
  words: AutomationsWords;
  /** The app's Automations routes (createAutomationsClient over its fetch, or its own functions). */
  client: AutomationsClient;
  track: (event: AutomationsEvent, detail?: string) => void;
}

// ---- Kinds ----------------------------------------------------------------------------------------------------------

/** A picker's section: a name and the kinds under it, in order. */
export interface KindGroup {
  id: string;
  name: string;
  kinds: readonly string[];
  /** Beside the group's name (an AI group's daily allowance). */
  note?: string;
}

export interface TriggerPanelProps<Trigger, Outline> {
  trigger: Trigger;
  onChange: (next: Trigger) => void;
  outline: Outline;
  /** The zone the rule is saved in (this browser's). */
  timeZone: string;
  /** How many conditions the rule has. */
  conditions: number;
}

export interface TriggerKind<Trigger, Outline> {
  name: string;
  /** What it hears, in a line: its tile's and its panel's. */
  line: string;
  /** A time: its tile wears the clock, and the rule's conditions pick what it runs on. */
  time?: boolean;
  /** Nobody of the item is behind it: nothing may name whoever triggered it. */
  personless?: boolean;
  /** Its tile's picture in Pick a Trigger (`group`: the section it is drawn under). */
  scene: (group: string) => ReactNode;
  /** Its first form (`from`: the trigger it replaces, for what carries over). */
  fresh: (outline: Outline, from?: Trigger) => Trigger;
  /** Its fields, under the Trigger row. None: nothing to set. */
  Panel?: ComponentType<TriggerPanelProps<Trigger, Outline>>;
}

export interface ConditionPanelProps<Condition, Outline> {
  condition: Condition;
  onChange: (next: Condition) => void;
  outline: Outline;
}

export interface ConditionKind<Condition, Outline> {
  name: string;
  /** It reads whoever started the rule: not offered under a trigger nobody is behind (`personless`). */
  personal?: boolean;
  fresh: (outline: Outline) => Condition;
  Panel?: ComponentType<ConditionPanelProps<Condition, Outline>>;
}

export interface ActionPanelProps<Step, Outline> {
  action: Step;
  onChange: (next: Step) => void;
  outline: Outline;
  /** A refusal's path inside this step ('' for the step itself, 'text' for its text), or null. */
  invalidPath: string | null;
  /** Inside the app's branch. */
  branch: boolean;
  /** The rule's trigger has nobody behind it. */
  personless: boolean;
}

export type GlyphType = ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;

/** One tile of Add an Action, keyed by `stepKey` (types.ts): a step's kind, `notify_<via>`, or `ai_<task>`. */
export interface ActionKind<Step, Outline> {
  name: string;
  /** What it does, in a line. */
  line: string;
  /** Its icon, on the blue tile. */
  glyph: GlyphType;
  scene: (group: string) => ReactNode;
  /** Its first form (`personless`: the rule's trigger has nobody behind it). */
  fresh: (outline: Outline, on: { personless: boolean }) => Step;
  /** Its fields. None: `note` says there is nothing to set. */
  Panel?: ComponentType<ActionPanelProps<Step, Outline>>;
  note?: string;
  /** The rule's top level only: never inside an If / Else or a branch. */
  top?: boolean;
  /** Left out of the app's branch. */
  notInBranch?: boolean;
  /** Nothing follows it: offered at the top level only, and it ends the rule. */
  last?: boolean;
  /** Its panel has no Action row to change it into another. */
  fixed?: boolean;
}

/** An app's own step that runs actions on each of several things (liveplanner: For Related Cards). */
export interface BranchKind<Step, Outline> {
  kind: string;
  name: string;
  glyph: GlyphType;
  fresh: (outline: Outline) => Step;
  /** The actions one holds. */
  max: number;
  /** What its card says, from its chip (`name`). */
  card: (step: Step, name: string, outline: Outline) => ReactNode;
  /** The line on its card while it holds no action. */
  empty: string;
  Panel: ComponentType<{ step: Step; onChange: (next: Step) => void; outline: Outline }>;
}

/** What is offered here and now (a feature the deployment has), read as a picker opens. */
export interface AutomationsOffer {
  /** Trigger groups left out, unless the rule is already on one of their kinds. */
  hiddenTriggerGroups?: ReadonlySet<string>;
  /** A line beside a trigger group's name ("Not Connected"). */
  triggerGroupNotes?: Readonly<Record<string, string>>;
  /** Template categories left out. */
  hiddenTemplateCategories?: ReadonlySet<string>;
}

export interface AutomationsKinds<
  Trigger extends AutomationKind,
  Condition extends AutomationKind,
  Step extends AutomationKind,
  Outline,
> {
  /** Pick a Trigger's sections, and what its empty search says: "Try another word, such as “moved”, “due” or “form”." */
  triggerGroups: readonly KindGroup[];
  triggerHint: string;
  triggers: Readonly<Record<Trigger['kind'], TriggerKind<Trigger, Outline>>>;
  /** The Rules list's All Triggers choices, in order. */
  triggerOrder: readonly Trigger['kind'][];
  /** A new rule's trigger. */
  firstTrigger: Trigger['kind'];
  /** Add Condition's kinds, in the record's own order. */
  conditions: Readonly<Record<Condition['kind'], ConditionKind<Condition, Outline>>>;
  /** Add an Action's sections (one whose kinds are all `top` shows at the rule's top level only), and what its empty
   *  search says. */
  actionGroups: readonly KindGroup[];
  actionHint: string;
  actions: Readonly<Record<string, ActionKind<Step, Outline>>>;
  branch?: BranchKind<Step, Outline>;
  /** A hook, called by each picker (`open`: while it shows, so a read behind it waits for the press). */
  useOffer?: (picker: { open: boolean }) => AutomationsOffer;
}

// ---- A rule in words ------------------------------------------------------------------------------------------------

export interface AutomationsSentence<
  Trigger extends AutomationKind,
  Condition extends AutomationKind,
  Step extends AutomationKind,
  Outline,
  Need,
  Gone,
> {
  /** The Rules list's sentence: joining words and chips. */
  rule: (
    rule: Pick<RuleBody<Trigger, Condition, Step>, 'trigger' | 'conditions' | 'steps'>,
    outline: Outline,
  ) => RuleSentencePart[];
  trigger: (trigger: Trigger, outline: Outline) => RuleSentencePart[];
  condition: (condition: Condition, outline: Outline) => string;
  /** A step's chip, an If / Else's, a branch's and a message step's too. */
  step: (step: Step, outline: Outline) => string;
  /** The text a step writes, drawn under its chip (a comment, an email's subject). */
  text?: (step: Step) => string | null;
  /** The label over a time rule's conditions: "For cards where". */
  picksLabel: string;
  /** A note on the When card (a time rule with no conditions runs on everything). */
  TriggerNote?: ComponentType<{ body: RuleBody<Trigger, Condition, Step>; compact?: boolean }>;
  /** Needs Attention, in words. */
  needs: (attention: readonly Need[]) => string;
  /** What a rule needs, worked out here from what the screen knows of the item (the outline); without it the row
   *  reads the list's own `rule.attention`. */
  attention?: (
    rule: Pick<RuleBody<Trigger, Condition, Step>, 'trigger' | 'conditions' | 'steps'>,
    outline: Outline,
  ) => readonly Need[];
  /** A way to fix what it needs, after the words. */
  NeedsFix?: ComponentType<{ attention: readonly Need[] }>;
  /** A failed step's line or a run's reason as people read it: never an id. */
  gone: (text: string, gone: Gone | undefined) => string;
  /** What a refused field's name asks for ("status": "a column"), for "Pick a column." where the api says a part
   *  must name one. */
  refusalPicks?: Readonly<Record<string, string>>;
  /** What a template left to pick, as the step's mark says it ("Pick a column"). */
  pick: (pick: string) => string;
  /** The picks whose slot is still empty. */
  picksLeft: (
    body: RuleBody<Trigger, Condition, Step>,
    picks: readonly AutomationTemplatePickAt[],
  ) => AutomationTemplatePickAt[];
}

/** The Audit Trail's subject column and its way to what a run was about. */
export interface AutomationsAudit<Run> {
  /** The column's heading: "Card", "Tab". */
  column: string;
  /** A run about the item alone: "No card". */
  none: string;
  subjectOf: (run: Run) => { id: string; title: string } | null;
  /** A hook answering how a subject is said in short ("#12"); '' for none. */
  useRef: () => (subject: { id: string; title: string }) => string;
  /** Opens what a run was about, the screen closed first. None: no link. */
  open?: { label: string; useGo: () => ((id: string) => void) | undefined };
  /** Which lines sit under a branch's, and how each reads: null for a line drawn as it is. */
  inset?: (steps: readonly RunLine[]) => readonly (ReactNode | null)[];
}

// ---- Templates, Test, messages, Incoming Webhook --------------------------------------------------------------------

export interface AutomationsTemplates<Outline, Body extends RuleBody> {
  list: readonly { id: string; name: string; description: string; category: string }[];
  categories: readonly { id: string; name: string }[];
  /** The template's rule over this item, and what it left to pick; null for an id it lacks. */
  build: (id: string, outline: Outline, timeZone: string) => RuleStart<Body> | null;
  /** The picture at the top of its tile. */
  scene: (id: string) => ReactNode;
}

export interface TestDialogProps<Body extends RuleBody, Outline> {
  body: Body;
  outline: Outline;
  /** Tries the rule as the builder holds it, on a subject (null: the item alone). */
  test: (rule: Body, subject: string | null) => Promise<{ run: ListedRun }>;
  /** A refusal naming a step: the builder marks it, and the test closes. */
  onRefused: (refusal: AutomationRefusal) => void;
  onClose: () => void;
}

export interface RunRuleProps<Rule extends ListedRule, Outline> {
  rule: Rule;
  outline: Outline;
  /** Runs the rule now, on a subject (null: the item alone). */
  run: (subject: string | null) => Promise<{ run: ListedRun }>;
  /** The run is over, or the person backed out: the screen takes this down. */
  onClose: () => void;
}

export interface AutomationsRunRule<Rule extends ListedRule, Outline> {
  /** Whether this rule shows Run Rule (it is on, and its trigger is the app's by-hand one). */
  offered: (rule: Rule) => boolean;
  /** Mounted when Run Rule is pressed: the app's pick of what it runs on (or none), the run and its toast. */
  Run: ComponentType<RunRuleProps<Rule, Outline>>;
}

export interface AutomationsMessages {
  /** A message step's first form: no connection picked, the app's own first words. */
  fresh: (via: AutomationVia) => AutomationOutgoing;
  /** Under the Message field, by where it posts. */
  hints: Readonly<Record<AutomationVia, string>>;
}

export interface AutomationsIncoming<Body extends RuleBody> {
  /** The example body How to Send posts: `{"cards": [12], "status": "green"}`. */
  example: string;
  /** How to Send's opening lines, about that body. */
  howTo: ReactNode;
  /** What a call runs on, under Runs On. */
  runsOn: (body: Body) => string;
  /** The signature header the app's route reads. */
  signatureHeader: string;
}

/** A view of the app's own, opened from a button beside New Rule and drawn in the screen's place (liveplanner's
 *  GitHub view); with `tab`, a tab after Connections instead. */
export interface AutomationsView {
  id: string;
  /** A hook: whether the view is offered here. */
  useOn: () => boolean;
  tab?: string;
  Button?: ComponentType<{ phone: boolean; footer?: boolean; onOpen: () => void }>;
  View: ComponentType<{
    scope: AutomationsScope;
    /** What the opener handed over (how a round trip went). */
    arrival: unknown;
    now: number;
    phone: boolean;
    onBack: () => void;
    trailing: ReactNode;
  }>;
  /** On the screen's hero header while the button shows (room for a wider row of buttons). */
  heroClassName?: string;
}

// ---- The kit ---------------------------------------------------------------------------------------------------------

export interface AutomationsKit<
  Trigger extends AutomationKind = AutomationKind,
  Condition extends AutomationKind = AutomationKind,
  Step extends AutomationKind = AutomationKind,
  Outline = unknown,
  Rule extends ListedRule<Trigger, Condition, Step> = ListedRule<Trigger, Condition, Step>,
  Run extends ListedRun = ListedRun,
  Gone = AutomationGone,
> {
  /** Words, the routes and telemetry: the same object the host was given. */
  plumbing: AutomationsPlumbing;
  /** The help article's button in the Rules tab's empty state ("How Rules Work"). */
  helpButton: ReactNode;
  kinds: AutomationsKinds<Trigger, Condition, Step, Outline>;
  sentence: AutomationsSentence<Trigger, Condition, Step, Outline, Rule['attention'][number], Gone>;
  /** A hook: the item as rules read it, for the sentence, the panels, the values and the templates. Opaque here. */
  useOutline: () => Outline;
  /** Insert a Value's groups for a text field of this rule (`branch`: inside the app's branch; `narrow`: what one of
   *  the app's own panels passed its field, to offer less; `body` null: a field drawn outside a builder). An Incoming
   *  Webhook rule's end with WEBHOOK_VALUE_GROUP (value-groups.ts): a field of the call's body, by its path. */
  values: (
    place: {
      body: RuleBody<Trigger, Condition, Step> | null;
      branch: boolean;
      narrow?: unknown;
      /** The step whose panel the field is in (what stands before it decides what it may read); absent for a
       *  field drawn outside a step's panel. */
      step?: AutomationKind | undefined;
    },
    outline: Outline,
  ) => ValueGroup[];
  /** Insert a Value's tooltip line: "Put a value of the card, like its title or due date, at the caret." */
  valuesLine: string;
  templates: AutomationsTemplates<Outline, RuleBody<Trigger, Condition, Step>>;
  /** The builder's test: the app's own way to pick what it runs on, or TestRuleDialog (no pick). */
  Test: ComponentType<TestDialogProps<RuleBody<Trigger, Condition, Step>, Outline>>;
  audit: AutomationsAudit<Run>;
  /** Run Rule on a rule's row and in its menu, for an app whose by-hand rules run from the list (liveplanner runs
   *  its own from a card, and has none). */
  runRule?: AutomationsRunRule<Rule, Outline>;
  messages: AutomationsMessages;
  incoming: AutomationsIncoming<RuleBody<Trigger, Condition, Step>>;
  /** The item's connections: the index's client, the item's app, and where a guest signs in (a hook). */
  connections: { client: IndexClient; app: App; useSignInHref: () => string };
  /** Describe a Rule's example chips and the box's placeholder. */
  describe: { examples: readonly { label: string; text: string }[]; placeholder: string };
  /** A step's text, filled in, under its panel (liveplanner: Preview on a card). */
  Preview?: ComponentType<{
    text: string;
    body: RuleBody<Trigger, Condition, Step>;
    outline: Outline;
    now: number;
    branch: boolean;
    /** A message step's "To Launch Channel". */
    via?: string | undefined;
  }>;
  /** The text a step's Preview fills: a comment's, an email's body. A message step's is always previewed. */
  previewText?: (step: Step) => string | null;
  views?: readonly AutomationsView[];
  /** Around the screen, inside its context (useAutomationsScreen): the app's own providers. */
  Provider?: ComponentType<{ children: ReactNode }>;
  /** Around the builder: what the app's panels read (liveplanner: its boards' email addresses). */
  BuilderProvider?: ComponentType<{ scope: AutomationsScope; children: ReactNode }>;
}

// The kit as the shared code holds it: every kind open (`{ kind: string }`), the outline unknown. An app's kit, typed
// over its own closed unions, becomes one through defineAutomationsKit.
export type AnyAutomationsKit = AutomationsKit;

/** An app's kit, typed in full where it is written, as the screen takes it. The one place the app's closed unions
 *  meet the screen's open kinds: a panel written for the app's own trigger is handed, by its kind, only that
 *  trigger. */
export function defineAutomationsKit<
  Trigger extends AutomationKind,
  Condition extends AutomationKind,
  Step extends AutomationKind,
  Outline,
  Rule extends ListedRule<Trigger, Condition, Step>,
  Run extends ListedRun,
  Gone,
>(kit: AutomationsKit<Trigger, Condition, Step, Outline, Rule, Run, Gone>): AnyAutomationsKit {
  return kit as unknown as AnyAutomationsKit;
}

/** The shared name of the builder's test; liveplanner says Test on a Card. */
export const TEST_RULE = 'Test Rule';
```

Beside the kit:

- `AutomationsApi` (automations-client.ts) is what `createAutomationsClient` takes: `url(scope)`, `fetch`,
  `headers(scope, body)`, `expectOk`, `expectOkVoid`, `errors` (the codes that are refusals) and
  `subject(subject)` (how a test and a run name what they run on in the body).
- `RuleSummaryKit` (RuleSummarySheet.tsx): `client` (`summary` alone), `item`, `goneNote`, `picksLabel`,
  `glyph(line)` and `useNow?`. The reader's sheet opens outside the screen, so it takes this and never the kit: its
  chunk carries no builder.
- The steps every app has are drawn by the package and need no panel from the kit: If / Else, Wait (`WaitPanel`), a
  message step (`OutgoingPanel`, its Action row offering the other tools). Their tiles still come from the kit's
  `actions` (`wait`, `notify_webhook`, `notify_slack`, `notify_teams`): the name, the line and the picture are the
  app's.
- **Run Rule from the list** is the kit's `runRule`: with it, a rule it says is `offered` shows a **Run Rule**
  button beside its name (`RuleRow`) and a Run Rule row first in its ⋯ menu (`RuleMenu`); pressing either mounts
  the kit's `Run` with `run(subject)`, and reports `rule_run`. Without it (liveplanner) neither is drawn.
- **What a rule needs** is the list's `rule.attention` unless the kit has `sentence.attention`, which works it out
  from the outline (an item's snapshots and connections are known only in the browser).
- `IncomingWebhookPanel` takes an optional `example`, in place of the kit's, for an app whose example names
  something of the open item.
- A kind is offered by where it goes: `top` (and `last`) only at the rule's top level, `notInBranch` never in the
  app's branch; a group left with no kind is not drawn. A message step, an AI step and a Wait are capped by the
  platform's limits (5, 3, 3), and their group says so when full. A `last` step ends the rule: nothing is added
  after it and it never moves up.

## The door

`AutomationsHost({ plumbing, scope, gate, signedIn, Screen, Gate, children })` holds the target (`AutomationsTarget`:
`rules`, `rule`, `runs`, `templates`, `connections`, or `view` with an app's view id), gives the footer its row
(`AutomationsDoorContext`) and an Editor the way in (`AutomationsContext`: `scope`, `plumbing`, `open`), reads the
list `AUTOMATIONS_FIRST_READ_MS` after the item settles, and opens on `?automations=1`. It draws `Screen` (for a
scope) or `Gate` (for a gate): both are the app's components, each a lazy wrapper, so neither the screen nor the
kit is in the editor's first load. `door-lazy-load.test.ts` pins what `src/index.ts` reaches to eleven files and
four outside modules, and holds that it reaches nothing under `item/`.

## The screen's context

Inside the screen, `useAutomationsScreen()` answers `{ scope, signedIn, openView(id, arrival?), openConnections(),
draft(), keepDraft(kept) }`. The builder tells the screen the rule it holds as it changes (`keepDraft`: body, picks,
the open step, the saved rule's id or null). `openConnections()` (a message step's **Add a Connection…**) holds that
rule and shows the Connections tab, which says it is kept and offers **Back to Rule**: the builder opens again on
the held body and step (`RuleBuilder`'s `resume`), the saved rule still its baseline, so unsaved stays unsaved.
While a rule is held, any way on but Back to Rule asks Discard Changes? first. `draft()` is for an app's own round
trip (liveplanner's Connect GitHub keeps a new rule in the session and opens it again as a `kept` target).

## What liveplanner's kit supplies

`liveplanner/apps/editor/components/automations/plan-kit.tsx` (`PLAN_AUTOMATIONS_KIT`), over the plan's own closed
unions from `@liveplanner/items`:

| Part      | From                                                                                                                                                                                                                                                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| plumbing  | `plan-plumbing.ts`: the words (plan, card, Test on a Card), `plan-client.ts` over `automations-client.ts`, and each event as its own `track('Plan', …)` call                                                                                                                                                               |
| kinds     | `trigger-groups.ts`, `action-groups.ts`, `step-defaults.ts`: one record per kind, mapped; `TriggerScene`, `ActionScene`; panels `TriggerPanel`, `ConditionPanel`, `ActionPanel`, `AiStepPanel`; the branch is For Related Cards (`BranchPanel`, 10 actions); `useOffer` hides GitHub's group and templates without the App |
| sentence  | `ruleSentence`, `triggerParts`, `conditionChip`, `stepChip`, `picksLeft` (`@liveplanner/items`); `needs-words.ts`; `plan-words.ts`; the When card's every-card warning                                                                                                                                                     |
| outline   | `useAutomationOutline` (`automation-outline.ts`)                                                                                                                                                                                                                                                                           |
| values    | `valueInsertGroups` (`value-insert-options.ts`)                                                                                                                                                                                                                                                                            |
| templates | `AUTOMATION_TEMPLATES` and `TemplateScene.tsx` (`template-scenes/`)                                                                                                                                                                                                                                                        |
| Test      | `TestOnCard.tsx`: the card finder, then the platform's result                                                                                                                                                                                                                                                              |
| audit     | the run's `card`, `useCardRefById`, Open Card, a branch's inset lines (`run-lines.tsx`)                                                                                                                                                                                                                                    |
| views     | the GitHub view (`github/GithubView.tsx`) behind `GithubButton`, where the deployment has the App                                                                                                                                                                                                                          |
| Provider  | `plan-screen-parts.tsx`: `GithubAutomationsContext`, the boards' email addresses, the Preview, the GitHub fix after Needs Attention                                                                                                                                                                                        |

Its host is `PlanAutomationsHost.tsx` (with `GithubReturn`), its lazy screen `PlanAutomationsScreen.tsx`, its lazy
gate `PlanAutomationsGate.tsx`, its reader's sheet `PlanRuleSummarySheet.tsx`. A card's ⋯ **Run Rule**
(`use-run-rule.ts`, `RunRuleMenu.tsx`) stays liveplanner's own.

## Mounting the screen in an editor

1. Add `@liveworkspace/automations-ui` to the editor (`corepack pnpm --filter <editor> add
'@liveworkspace/automations-ui@workspace:*'`), and to its stylesheet the line that scans the package for
   classes (`@source '…/packages/automations-ui/src';`), beside the workbench's. Bring in the pictures' motion:
   `@import '@liveworkspace/automations-ui/automation-scenes.css';` in the editor's stylesheet.

   An app whose items have tabs and no cards (livediagram, livedocuments, livedesign, livehuddle) follows
   [item-ui.md](./item-ui.md) "Mounting Automations in an item editor" in place of steps 2 to 6.

2. Write the routes: `createAutomationsClient<Body, Rule, Run>({ url, fetch, headers, expectOk, expectOkVoid,
errors, subject })` over the editor's own fetch and its `/automations` routes.
3. Write the plumbing, a module constant that imports nothing of the screen: the words (item, subject, toolLine,
   subtitle, empty, test: `TEST_RULE` unless the app has its own), the client, and `track(event, detail)` as a
   switch of the app's own telemetry calls written out (its emitter scan reads them).
4. Write the kit with `defineAutomationsKit` in a module only the lazy screen imports: map the app's kinds registry
   into `kinds.triggers`, `kinds.conditions` and `kinds.actions` (name, line, picture, first form, panel; `top`,
   `last`, `notInBranch` where they apply), with `wait` and the three `notify_*` tiles among the actions;
   `sentence`; `useOutline`; `values` (ending an Incoming Webhook rule's with `WEBHOOK_VALUE_GROUP`); `templates`;
   `Test` (`TestRuleDialog`, or the app's own pick then `TestRuleResult`); `audit`; `messages`; `incoming`;
   `connections` (`indexClient`, the app's name); `describe`. Use `ScheduledPanel` for Scheduled and
   `IncomingWebhookPanel` for Incoming Webhook unless the app adds to them.
5. Write the lazy screen: a component taking `AutomationsScreenProps` that renders
   `<AutomationsKitProvider kit={KIT}><AutomationsDialog {...props} /></AutomationsKitProvider>`, inside whatever
   providers the app's panels read.
6. Write the lazy gate: a component taking `{ gate, onClose }` that renders `AutomationsSyncGate` with the app's
   Sync gate dialog, its sign-in address and its help link.
7. In the editor view's hooks, work out `automationsScopeFor(input)` and `useAutomationsGate({ ...input, ready,
sync, badges })` (the scope's `itemId` is the item's id; `badges` memoised).
8. Mount `<AutomationsHost plumbing scope gate signedIn Screen Gate>` around the editor, above the footer, with
   `Screen` and `Gate` loaded by the app's dynamic import.
9. Put `useAutomationsToolsItem()` in the footer's Tools items.
10. Where a rule's change shows (a comment, a history line), open `RuleSummarySheet` for readers with a
    `RuleSummaryKit`, from a chunk of its own.
11. Guard it: a test that the editor's first load reaches the door alone (liveplanner's
    `plan-automations-lazy.test.ts` is the pattern), the editor's telemetry manifest, its Tools rows test.

## Performance

- **First load.** The door is eleven files of this package (the host, two contexts, the gate's rule, the row, the
  list, the client, the glyphs) and none of the screen; the screen, the kit and every panel, picture and template
  load when the screen first opens, the gate when it first opens, the reader's sheet when a rule's name is first
  pressed. The Connections list (`@liveworkspace/settings-ui/connections`) loads when its tab first opens
  (`ConnectionsTab`'s `lazy`), so the screen's chunk does not carry it. Two tests hold it: `door-lazy-load.test.ts` here, `plan-automations-lazy.test.ts` in liveplanner's editor.
- **Renders.** The kit is constant, so its context never changes. The screen's own context (`AutomationsScreen`) is
  memoised on the scope alone and reads its guard through a ref. The builder's rule context changes with the body
  (its panel re-renders with the body anyway). A text field reads the item's outline from the open panel
  (`PanelOutlineProvider`), not by working it out again per field.
- **Reads.** One list per item, shared by the row, the screen and an app's own readers; the connections are read
  once per builder, when a message step's panel first opens (again by the builder that opens on Back to Rule).

## Tests

| File                                                               | Covers                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/kit.test.tsx`                                                 | the seam, over `test/fake-kit.tsx`: the list, the empty state and a template, building and saving, Test Rule, a run on the Audit Trail, the Connections tab, Add a Connection… keeping the rule, Fix Connection, an app's view as a button and as a tab, a `last` step, a steady kit, the phone drawer |
| `src/door.test.tsx`                                                | the host, the row's count and amber, the gate, `?automations=1`, the sync gate's copy                                                                                                                                                                                                                  |
| `src/door-lazy-load.test.ts`                                       | what the door reaches                                                                                                                                                                                                                                                                                  |
| `src/rule-draft.test.ts`                                           | every edit op over open kinds, 100%                                                                                                                                                                                                                                                                    |
| `src/automations-client.test.ts`                                   | each route, refusals, 100%                                                                                                                                                                                                                                                                             |
| `src/item/*.test.ts(x)`                                            | the item kit: [item-ui.md](./item-ui.md) "Tests"                                                                                                                                                                                                                                                       |
| `style-guards.test.ts`                                             | optical alignment, touch targets and the motion budget over `src` (the pictures' stylesheet is a content illustration, outside the budget)                                                                                                                                                             |
| `src/pure.test.ts`                                                 | the gate's rule, refusal words, run words, value groups, step shapes, each 100%                                                                                                                                                                                                                        |
| `src/ScreenTabs.test.tsx`                                          | the four tabs, the keys, an app's own tab, 100%                                                                                                                                                                                                                                                        |
| `src/AutomationsHeroArt.test.tsx`, `src/AddActionHeroArt.test.tsx` | the hero art's tokens                                                                                                                                                                                                                                                                                  |

liveplanner's editor suite (`liveplanner/apps/editor/components/automations/*.test.tsx`) drives the same screen
through the plan's kit, with a plan's real kinds: it stayed there with its fixtures, and reads the kit through
`test-kit.ts` (`setFallbackAutomationsKit`).
