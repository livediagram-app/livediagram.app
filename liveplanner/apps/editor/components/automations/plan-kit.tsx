'use client';

// liveplanner's kit for the platform's Automations screen (docs/specs/026-plan/automations.md; the platform's
// blueprint ui.md "The kit"): everything of a plan's own in one object. Its triggers, conditions and actions with
// their names, lines, pictures, first forms and panels, each keyed by its kind; a rule's sentence; the plan as rules
// read it (useAutomationOutline); the values a text may hold; the templates; Test on a Card; the Audit Trail's card;
// the GitHub view; and the plumbing the host already holds. A constant: the screen reads it from context in every
// row and panel, and what changes while it is open comes through its hooks. Loaded with the screen, never with the
// editor's first paint (plan-automations-lazy.test.ts).

import {
  AUTOMATION_AI_PER_DAY,
  AUTOMATION_BRANCH_ACTIONS_MAX,
  AUTOMATION_CONDITION_NAMES,
  AUTOMATION_RELATED_NAMES,
  AUTOMATION_STEP_NAMES,
  AUTOMATION_TEMPLATE_CATEGORIES,
  AUTOMATION_TEMPLATE_CATEGORY_NAMES,
  AUTOMATION_TEMPLATES,
  AUTOMATION_TRIGGER_KINDS,
  AUTOMATION_TRIGGER_NAMES,
  WEBHOOK_SIGNATURE_HEADER,
  automationTemplate,
  conditionChip,
  isGithubTrigger,
  isPersonless,
  picksLeft,
  ruleSentence,
  runsWithoutCard,
  stepChip,
  triggerParts,
  type AutomationAi,
  type AutomationBranch,
  type AutomationCondition,
  type AutomationGone,
  type AutomationRun,
  type AutomationStep,
  type AutomationTemplateId,
  type AutomationTrigger,
  type AutomationTriggerKind,
} from '@liveplanner/items';
import type { AutomationListedRule } from '@liveplanner/api-schema';
import { SparkleIcon } from '@liveplanner/ui';
import { NOTIFY_GLYPHS, WaitGlyph } from '@liveworkspace/automations-ui/glyphs';
import { crossAppGroup } from '@liveworkspace/automations-ui/cross-app/cross-app-group';
import { snapshotGroup, snapshotKitActions } from '@liveworkspace/automations-ui/item/snapshot-kit';
import { crossAppKitActions } from '@liveworkspace/automations-ui/cross-app/cross-app-kit';
import {
  defineAutomationsKit,
  type ActionKind,
  type ActionPanelProps,
  type AutomationsOffer,
  type ConditionKind,
  type TriggerKind,
} from '@liveworkspace/automations-ui/kit';
import { CHIP } from '@liveworkspace/automations-ui/SentenceChips';
import { HOOK_CODE } from '@liveworkspace/automations-ui/step-panels/IncomingWebhookPanel';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { useMemo } from 'react';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
import { usePlan } from '@/components/plan/PlanContext';
import { useCardRefById } from '@/components/plan/card-ref';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { useCapabilities } from '@/hooks/persistence/useCapabilities';
import { ACTION_GROUPS, ACTION_LINES, type ActionGroupId } from './action-groups';
import { ActionScene } from './ActionScene';
import { ACTION_GLYPHS, BranchGlyph } from './automation-glyphs';
import {
  fieldChangeFields,
  outlineFields,
  useAutomationOutline,
  type AutomationOutline,
  type OutlineField,
} from './automation-outline';
import type { AutomationsScope } from './automations-client';
import { GithubButton } from './github/GithubButton';
import type { GithubResult } from './github/github-hash';
import { useGithubAutomations } from './github/github-automations';
import { GithubView } from './github/GithubView';
import { useGithubConnection } from './github/use-github-connection';
import { goneText, needsWords } from './needs-words';
import { PLAN_AUTOMATIONS_PLUMBING } from './plan-plumbing';
import {
  DESCRIBE_EXAMPLES,
  DESCRIBE_PLACEHOLDER,
  PLAN_PICK_WORDS,
  REFUSAL_PICKS,
} from './plan-words';
import {
  PlanBuilderProvider,
  PlanNeedsFix,
  PlanScreenProvider,
  PlanStepPreview,
} from './plan-screen-parts';
import { PLAN_BRANCH_START } from './rule-draft';
import { insetRunLines } from './run-lines';
import {
  ADD_NAMES,
  CONDITION_KINDS,
  defaultCondition,
  defaultOutgoing,
  defaultStep,
  isAiKind,
  isOutgoingKind,
  viaOf,
  type AddKind,
} from './step-defaults';
import { ActionPanel } from './step-panels/ActionPanel';
import { AiStepPanel } from './step-panels/AiStepPanel';
import { BranchPanel } from './step-panels/BranchPanel';
import { ConditionPanel } from './step-panels/ConditionPanel';
import { PlanTriggerNote } from './step-panels/TimeTriggerPanel';
import { TriggerPanel } from './step-panels/TriggerPanel';
import { TemplateScene } from './TemplateScene';
import { TestOnCard } from './TestOnCard';
import {
  TRIGGER_GROUPS,
  TRIGGER_LINES,
  freshTrigger,
  isTimeKind,
  type TriggerGroupId,
} from './trigger-groups';
import { TriggerScene } from './TriggerScene';
import { valueInsertGroups } from './value-insert-options';

// ---- Triggers -------------------------------------------------------------------------------------------------------

const triggerKind = (
  kind: AutomationTriggerKind,
): TriggerKind<AutomationTrigger, AutomationOutline> => ({
  name: AUTOMATION_TRIGGER_NAMES[kind],
  line: TRIGGER_LINES[kind],
  time: isTimeKind(kind),
  // A time, an incoming webhook, an email and GitHub have nobody of the plan behind them.
  personless: isPersonless({ kind } as AutomationTrigger),
  scene: (group) => <TriggerScene kind={kind} group={group as TriggerGroupId} />,
  // Field Changed starts on the plan's first field, Column Over Limit on its first column; from one GitHub trigger to
  // another the repositories it names stay (trigger-groups.ts).
  fresh: (outline, from) =>
    freshTrigger(
      kind,
      fieldChangeFields(outline.types).map((f) => f.id),
      outline.columns.map((c) => c.status),
      from,
    ),
  Panel: TriggerPanel,
});

// No plan: the connection is never read outside the Automations screen.
const NO_SCOPE: AutomationsScope = { ownerId: '', itemId: '', shareCode: null };
const GITHUB_ALONE: ReadonlySet<string> = new Set(['github']);
const NOT_CONNECTED: Readonly<Record<string, string>> = { github: 'Not Connected' };

// GitHub's triggers and templates only where the deployment has liveplanner's GitHub App; in Pick a Trigger, its
// group says Not Connected while the plan has no connection (read as the picker opens).
function usePlanOffer({ open }: { open: boolean }): AutomationsOffer {
  const gh = useGithubAutomations();
  const enabled = !!gh?.enabled;
  const github = useGithubConnection(gh?.scope ?? NO_SCOPE, open && enabled);
  const unconnected = github.status === 'ready' && !github.connection;
  return useMemo<AutomationsOffer>(
    () => ({
      ...(enabled
        ? {}
        : { hiddenTriggerGroups: GITHUB_ALONE, hiddenTemplateCategories: GITHUB_ALONE }),
      ...(unconnected ? { triggerGroupNotes: NOT_CONNECTED } : {}),
    }),
    [enabled, unconnected],
  );
}

// ---- Conditions and actions -----------------------------------------------------------------------------------------

const conditionKind = (
  kind: AutomationCondition['kind'],
): ConditionKind<AutomationCondition, AutomationOutline> => ({
  name: AUTOMATION_CONDITION_NAMES[kind],
  fresh: (outline) => defaultCondition(kind, outline),
  Panel: ConditionPanel,
});

// An AI step's panel, as the platform hands a step to it.
function AiPanel({
  action,
  onChange,
  outline,
}: ActionPanelProps<AutomationStep, AutomationOutline>) {
  return <AiStepPanel step={action as AutomationAi} outline={outline} onChange={onChange} />;
}

// A card action's panel: the platform never hands it a step of the top level alone.
function CardActionPanel(props: ActionPanelProps<AutomationStep, AutomationOutline>) {
  return <ActionPanel {...(props as Parameters<typeof ActionPanel>[0])} />;
}

// The kinds a branch leaves out: it makes no card.
const NOT_IN_BRANCH: ReadonlySet<AddKind> = new Set(['create_card', 'copy_card']);

const actionKind = (key: AddKind): ActionKind<AutomationStep, AutomationOutline> => {
  const ai = isAiKind(key);
  const outgoing = isOutgoingKind(key);
  const plain = !ai && !outgoing && key !== 'wait';
  return {
    name: ADD_NAMES[key],
    line: ACTION_LINES[key],
    glyph: ai
      ? SparkleIcon
      : outgoing
        ? NOTIFY_GLYPHS[viaOf(key)]
        : key === 'wait'
          ? WaitGlyph
          : ACTION_GLYPHS[key],
    scene: (group) => <ActionScene kind={key} group={group as ActionGroupId} />,
    fresh: (outline, { personless }) => defaultStep(key, outline, personless),
    // A message step's and a Wait's panels are the platform's.
    ...(plain ? { Panel: CardActionPanel } : ai ? { Panel: AiPanel, fixed: true } : {}),
    ...(plain ? {} : { top: true }),
    ...(NOT_IN_BRANCH.has(key) ? { notInBranch: true } : {}),
  };
};

// A Form Response rule's questions (its form's, or every form's for Any Form): Insert a Value offers their answers.
function formQuestions(
  trigger: AutomationTrigger,
  outline: AutomationOutline,
): readonly string[] | undefined {
  if (trigger.kind !== 'form_response') return undefined;
  const formTab = trigger.formTab ?? '';
  return [
    ...new Set(
      outline.forms.filter((f) => !formTab || f.id === formTab).flatMap((f) => f.questions ?? []),
    ),
  ];
}

const GITHUB_VIEW = {
  id: 'github',
  // GitHub, from the one capabilities read the editor shares.
  useOn: () => useCapabilities().githubEnabled,
  Button: GithubButton,
  View: ({
    scope,
    arrival,
    now,
    phone,
    onBack,
    trailing,
  }: {
    scope: AutomationsScope;
    arrival: unknown;
    now: number;
    phone: boolean;
    onBack: () => void;
    trailing: React.ReactNode;
  }) => (
    <GithubView
      scope={scope}
      // How the round trip to GitHub went, when the view opened on coming back.
      {...(arrival ? { result: arrival as GithubResult } : {})}
      now={now}
      phone={phone}
      onBack={onBack}
      trailing={trailing}
    />
  ),
  // The art's centre clears the wider actions when GitHub's button stands beside New Rule.
  heroClassName: '[--hero-centre-end:18rem]',
};

export const PLAN_AUTOMATIONS_KIT = defineAutomationsKit<
  AutomationTrigger,
  AutomationCondition,
  AutomationStep,
  AutomationOutline,
  AutomationListedRule,
  AutomationRun,
  AutomationGone
>({
  plumbing: PLAN_AUTOMATIONS_PLUMBING,
  helpButton: <HelpArticleLink article="planAutomations" variant="button" label="How Rules Work" />,
  kinds: {
    triggerGroups: TRIGGER_GROUPS,
    triggerHint: 'Try another word, such as “moved”, “due” or “form”.',
    triggers: Object.fromEntries(
      AUTOMATION_TRIGGER_KINDS.map((kind) => [kind, triggerKind(kind)]),
    ) as Record<AutomationTriggerKind, TriggerKind<AutomationTrigger, AutomationOutline>>,
    triggerOrder: AUTOMATION_TRIGGER_KINDS,
    firstTrigger: 'card_created',
    conditions: Object.fromEntries(
      CONDITION_KINDS.map((kind) => [kind, conditionKind(kind)]),
    ) as Record<AutomationCondition['kind'], ConditionKind<AutomationCondition, AutomationOutline>>,
    // Snapshots stands after Comments, In Other Apps before AI (cross-app/cross-app-group.ts).
    actionGroups: ACTION_GROUPS.flatMap((g) =>
      g.id === 'ai'
        ? [crossAppGroup(), { ...g, note: `${AUTOMATION_AI_PER_DAY} a day per plan` }]
        : g.id === 'comments'
          ? [g, snapshotGroup()]
          : [g],
    ),
    actionHint: 'Try another word, such as “label”, “email” or “Slack”.',
    actions: {
      ...Object.fromEntries(
        (Object.keys(ADD_NAMES) as AddKind[]).map((key) => [key, actionKind(key)]),
      ),
      // The steps in other apps: the platform's tiles and panels, as every app's.
      ...crossAppKitActions<AutomationStep, AutomationOutline>(),
      // Take Snapshot and Revert to Snapshot: the platform's tiles and panels (spec "Snapshot steps").
      ...snapshotKitActions<AutomationStep, AutomationOutline>('plan'),
    },
    branch: {
      kind: 'for',
      name: AUTOMATION_STEP_NAMES.for,
      glyph: BranchGlyph,
      fresh: () => PLAN_BRANCH_START(),
      max: AUTOMATION_BRANCH_ACTIONS_MAX,
      card: (step, name) => (
        <span className="flex flex-wrap items-center gap-1 text-[13px] font-medium">
          For each
          <span className={CHIP}>
            {name.slice('For each '.length) ||
              AUTOMATION_RELATED_NAMES[(step as AutomationBranch).related.kind]}
          </span>
        </span>
      ),
      empty: 'Add an action to run on each one.',
      Panel: ({ step, onChange, outline }) => (
        <BranchPanel step={step as AutomationBranch} outline={outline} onChange={onChange} />
      ),
    },
    useOffer: usePlanOffer,
  },
  sentence: {
    rule: ruleSentence,
    trigger: triggerParts,
    condition: conditionChip,
    step: stepChip,
    // A message step's text is the platform's to draw.
    text: (step) =>
      step.kind === 'comment' ? step.text : step.kind === 'email' ? step.subject : null,
    picksLabel: 'For cards where',
    TriggerNote: PlanTriggerNote,
    needs: needsWords,
    NeedsFix: PlanNeedsFix,
    gone: goneText,
    refusalPicks: REFUSAL_PICKS,
    pick: (pick) => PLAN_PICK_WORDS[pick] ?? pick,
    picksLeft: (body, picks) => picksLeft(body, picks as Parameters<typeof picksLeft>[1]),
  },
  useOutline: useAutomationOutline,
  values: ({ body, branch, narrow }, outline) => {
    const trigger = body?.trigger;
    return valueInsertGroups(
      branch,
      (narrow as readonly OutlineField[] | undefined) ?? outlineFields(outline.types),
      trigger?.kind === 'incoming_webhook',
      !!trigger && isGithubTrigger(trigger),
      trigger?.kind === 'email_received',
      trigger ? formQuestions(trigger, outline) : undefined,
    );
  },
  valuesLine: 'Put a value of the card, like its title or due date, at the caret.',
  templates: {
    list: AUTOMATION_TEMPLATES,
    categories: AUTOMATION_TEMPLATE_CATEGORIES.map((id) => ({
      id,
      name: AUTOMATION_TEMPLATE_CATEGORY_NAMES[id],
    })),
    build: (id, outline, timeZone) =>
      automationTemplate(id)?.build({
        statuses: outline.columns,
        phases: outline.phases,
        types: outline.types,
        timeZone,
      }) ?? null,
    scene: (id) => <TemplateScene id={id as AutomationTemplateId} />,
  },
  Test: TestOnCard,
  audit: {
    column: 'Card',
    none: 'No card',
    subjectOf: (run) => run.card,
    // A run's card carries its number: the ref reads it where the plan no longer has the card.
    useRef: () => useCardRefById() as unknown as (subject: { id: string; title: string }) => string,
    open: { label: 'Open Card', useGo: () => usePlan()?.openItem },
    inset: (steps) => insetRunLines(steps as AutomationRun['steps']),
  },
  messages: {
    fresh: defaultOutgoing,
    hints: {
      webhook: 'Sent as a signed JSON event with the rule and the card.',
      slack: 'Posted with an Open in liveplanner link to the card.',
      teams: 'Posted as a card with an Open in liveplanner link.',
    },
  },
  incoming: {
    example: `{"cards": [12], "status": "green"}`,
    howTo: (
      <>
        Send JSON, up to 16 KB. Name cards by number in <code className={HOOK_CODE}>cards</code> (up
        to 10); anything else in the body is yours to read with Webhook Field values. Set{' '}
        <code className={HOOK_CODE}>SECRET</code> to the rule’s secret first.
      </>
    ),
    // Whether the rule as it stands can run with no card (@liveplanner/items runsWithoutCard).
    runsOn: (body) =>
      runsWithoutCard(body)
        ? 'The cards the call names. With none named, it runs once with no card.'
        : 'The cards the call names. Its steps change a card, so the call must name cards.',
    // The header liveplanner shipped with, which its route keeps reading.
    signatureHeader: WEBHOOK_SIGNATURE_HEADER,
  },
  connections: {
    client: indexClient,
    app: 'liveplanner',
    useSignInHref: () => useAuthHrefs().signInHref,
  },
  describe: { examples: DESCRIBE_EXAMPLES, placeholder: DESCRIBE_PLACEHOLDER },
  Preview: PlanStepPreview,
  previewText: (step) =>
    step.kind === 'comment'
      ? step.text
      : step.kind === 'email'
        ? step.body
        : step.kind === 'take_snapshot'
          ? step.name
          : null,
  views: [GITHUB_VIEW],
  Provider: PlanScreenProvider,
  BuilderProvider: PlanBuilderProvider,
});
