// The seam between the Automations screen and an app (liveworkspace/docs/specs/018-automations/automations.md "Built
// once"; blueprint ui.md "The kit"). The screen, the builder and the pickers are built once here and know no app's
// kinds, words or content: an app hands them an AutomationsKit, everything of its own in one object.
//
// The kit must be referentially stable: a module constant, or memoised once per item. The screen reads it from
// context in every row, card and panel, so a kit rebuilt on a render re-renders the whole screen. What changes while
// the screen is open (the item's content, a feature the deployment has) is read through the kit's hooks (`useOutline`,
// `useOffer`, a view's `useOn`), never by rebuilding the kit.
//
// Everything about one kind sits in one record keyed by that kind (`kinds.triggers`, `kinds.conditions`,
// `kinds.actions`), so an app whose kinds come from a registry builds its kit with a map over it, and the shared code
// never switches on a kind it does not own (`if`, `wait`, `notify` and the shape of an `ai` step).

import type { ComponentType, ReactNode } from 'react';
import type { App, IndexClient } from '@liveworkspace/index-client';
import type {
  AutomationGone,
  AutomationKind,
  AutomationOutgoing,
  AutomationTemplatePickAt,
  AutomationVia,
  RuleSentencePart,
} from '@liveworkspace/automations';
import type { AutomationRefusal, AutomationsClient } from './automations-client';
import type { ListedRule, ListedRun, RuleBody, RuleStart, RunLine } from './types';
import type { ValueGroup } from './value-groups';

// Who is asking, about which item: the routes' scope (a share link's code rides along). `as`: who the app says is
// asking, at what share level (automationsScopeFor), so a list refused for one asker is read again for another (an
// Editor granted mid-session, a different account); absent, the share code alone tells askers apart.
export type AutomationsScope = {
  ownerId: string;
  itemId: string;
  shareCode: string | null;
  as?: string;
};

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
  // Take Over Rule, on a rule paused on a step in another app's lost access.
  | 'rule_taken_over'
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
  /** A pill after the group's name ("New"). */
  badge?: string;
  /** A line under the group's tiles (In Other Apps: who every step acts as). */
  footnote?: string;
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
