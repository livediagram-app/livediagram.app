'use client';

// The rule builder (docs/specs/026-plan/automations.md "The rule builder"): the bar (the breadcrumb back to
// Automations, the name editable in place, the On / Off chip, "Edited by … · when", Test on a Card, Save Rule), the
// steps on the left and the selected step's panel on the right, and Rule Details under the steps; on a phone the
// rule drawer's ("The rule builder on a phone"): PhoneRuleHeader, the steps scrolling, PhoneRuleFoot with Rule
// Details pinned, and the picked step's panel in its own drawer (StepDrawer). It holds the rule as changed; the dialog asks Discard Changes? before leaving it dirty (onDirty). A
// refusal's `path` marks the step at fault and selects it. A rule opened from a template (or drafted by Describe a
// Rule, with its `notice` above the steps) marks the steps it left to pick until they are picked. It holds the plan's webhooks for its outgoing actions, read once when one first opens.
// A save stamps the rule with this browser's time zone, the saver's (spec "Time triggers").

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AutomationListedRule } from '@liveplanner/api-schema';
import {
  AUTOMATION_NAME_MAX,
  AUTOMATION_PICK_WORDS,
  isGithubTrigger,
  isPersonless,
  picksLeft,
  runsWithoutCard,
  type AutomationRuleBody,
  type AutomationTemplatePickAt,
} from '@liveplanner/items';
import { Button, Switch, formatRelativeTimeShort } from '@liveplanner/ui';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { track } from '@/lib/telemetry';
import { useToast } from '@/hooks/ui/useToast';
import type { AutomationOutline } from './automation-outline';
import { AutomationRefusal, type AutomationsScope } from './automations-client';
import { useGithubAutomations } from './github/github-automations';
import { IncomingRuleProvider, type IncomingRule } from './incoming-rule';
import { PlanWebhooksProvider, usePlanWebhooksState } from './plan-webhooks';
import {
  addAction,
  addBranch,
  addCondition,
  addIfElse,
  bodyOf,
  editPart,
  partAt,
  sameBody,
  type RulePart,
} from './rule-draft';
import { PhoneRuleFoot, PhoneRuleHeader } from './PhoneRuleChrome';
import { RuleDetails } from './RuleDetails';
import { RuleSteps, type StepsActions } from './RuleSteps';
import { defaultCondition, defaultStep } from './step-defaults';
import { StepPanel } from './StepPanel';
import { TestOnCard } from './TestOnCard';
import type { AutomationsApi } from './use-automations';

type Fault = { path: string; message: string };

const REFUSAL_WORDS: Readonly<Record<string, string>> = {
  automation_name_taken: 'Another rule here has this name. Pick another.',
  automation_rules_full: 'This plan has 50 rules, the most it can hold. Delete one to add another.',
  automation_value_unknown:
    'This names a value rules don’t know. Pick one from Insert a Value in the field.',
  automation_not_found: 'This rule was deleted elsewhere.',
  automation_condition_unsupported:
    'A time trigger has nobody behind it: nothing here can name whoever triggered it.',
  automation_step_unsupported:
    'This step can’t go here: a branch or an If / Else holds no outgoing action, branch or If.',
};

const refusalMessage = (r: AutomationRefusal) => REFUSAL_WORDS[r.code] ?? r.message;

export function RuleBuilder({
  rule,
  initial,
  outline,
  api,
  person,
  now,
  phone,
  onBack,
  onSaved,
  onDirty,
  trailing,
  picks = [],
  timeZone,
  scope,
  signedIn = false,
  onOpenWebhooks,
  notice,
}: {
  // The saved rule, or null for one not saved yet.
  rule: AutomationListedRule | null;
  // What the builder starts from: the saved rule's body, or a new rule's.
  initial: AutomationRuleBody;
  outline: AutomationOutline;
  api: Pick<AutomationsApi, 'save' | 'toggle' | 'test'>;
  // Who is building it, for the previews.
  person: string;
  now: number;
  phone: boolean;
  onBack: () => void;
  onSaved: (rule: AutomationListedRule) => void;
  onDirty: (dirty: boolean) => void;
  // The dialog's close, at the bar's end.
  trailing?: React.ReactNode;
  // What the template it was opened from left to pick.
  picks?: readonly AutomationTemplatePickAt[];
  // This browser's time zone: the rule is saved in it.
  timeZone: string;
  // The plan, for its webhooks; and whether the person is signed in (webhooks are an account's).
  scope: Pick<AutomationsScope, 'projectId' | 'shareCode'>;
  signedIn?: boolean;
  // Opens the plan's Webhooks dialog, calling back when it closes.
  onOpenWebhooks?: ((onClosed: () => void) => void) | undefined;
  // A note above the steps: Drafted by AI, for a rule Describe a Rule drafted.
  notice?: React.ReactNode;
}) {
  const toast = useToast();
  const webhooks = usePlanWebhooksState({ scope, signedIn, onOpenDialog: onOpenWebhooks });
  const [saved, setSaved] = useState(() => bodyOf(initial));
  const [body, setBody] = useState(() => bodyOf(initial));
  const [selected, setSelected] = useState<RulePart | null>({ part: 'trigger' });
  // A phone's step drawer: opened by a pick, an add or a refusal, never by the first selection.
  const [stepOpen, setStepOpen] = useState(false);
  const [fault, setFault] = useState<Fault | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [testing, setTesting] = useState(false);
  const dirty = !rule || !sameBody(body, saved);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  // A new rule as it stands, for Connect GitHub to keep for the round trip (github-return.ts).
  const github = useGithubAutomations();
  const keepDraft = github?.keepDraft;
  useEffect(() => {
    if (!keepDraft || rule) return;
    keepDraft({ ...body, timeZone });
    return () => keepDraft(null);
  }, [keepDraft, rule, body, timeZone]);
  const pickMarks = useMemo(
    () => new Map(picksLeft(body, picks).map((p) => [p.path, AUTOMATION_PICK_WORDS[p.pick]])),
    [body, picks],
  );

  const change = (next: AutomationRuleBody, part?: RulePart | null) => {
    setBody(next);
    if (part !== undefined) {
      setSelected(part);
      setStepOpen(part !== null);
    }
    setFault(null);
  };

  const refused = (r: AutomationRefusal) => {
    const path = r.path ?? (r.code === 'automation_name_taken' ? 'name' : '');
    setFault({ path, message: refusalMessage(r) });
    const part = path ? partAt(body, path) : null;
    if (part) {
      setSelected(part);
      setStepOpen(true);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    // What went to the api: an edit made while it saves is kept, not replaced by the saved rule.
    const sent = body;
    try {
      const next = await api.save(rule?.id ?? null, { ...sent, timeZone });
      if (!rule) {
        track('Plan', 'Created', 'AutomationRule');
        if (isGithubTrigger(body.trigger)) track('Plan', 'Created', 'AutomationRuleGithub');
      }
      setSaved(bodyOf(next));
      setBody((held) => (held === sent ? bodyOf(next) : held));
      setFault(null);
      toast.success(`Saved ${next.name}`);
      onSaved(next);
    } catch (error) {
      debugLog('[automations] save.failed', { error: String(error) });
      if (error instanceof AutomationRefusal) refused(error);
      else toast.error('The rule didn’t save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (enabled: boolean) => {
    if (!rule || toggling) return;
    setToggling(true);
    try {
      await api.toggle(rule.id, enabled);
      track('Plan', 'Toggled', enabled ? 'AutomationOn' : 'AutomationOff');
    } catch (error) {
      debugLog('[automations] toggle.failed', { error: String(error) });
      toast.error(
        error instanceof AutomationRefusal
          ? refusalMessage(error)
          : 'The rule didn’t change. Try again.',
      );
    } finally {
      setToggling(false);
    }
  };

  const actions: StepsActions = {
    select: (part) => {
      setSelected(part);
      setStepOpen(true);
    },
    edit: (part, edit) => {
      const next = editPart(body, part, edit);
      change(next.body, next.part);
    },
    addCondition: (kind, ifStep) => {
      const next = addCondition(body, defaultCondition(kind, outline), ifStep);
      change(next.body, next.part);
    },
    addAction: (kind, branch) => {
      // A time trigger or an incoming webhook has nobody behind it: Assign starts on the plan's first person.
      const step = defaultStep(kind, outline, isPersonless(body.trigger));
      const next = addAction(body, step, branch);
      change(next.body, next.part);
    },
    addIfElse: () => {
      const next = addIfElse(body);
      change(next.body, next.part);
    },
    addBranch: () => {
      const next = addBranch(body);
      change(next.body, next.part);
    },
  };

  const stepFault = fault && fault.path && fault.path !== 'name' ? partAt(body, fault.path) : null;
  const nameFault = fault?.path === 'name' ? fault.message : null;
  const otherFault = fault && !nameFault && !stepFault ? fault.message : null;

  const bar = (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 dark:border-slate-800 ${phone ? 'px-4 py-3' : 'px-5 py-3.5'}`}
    >
      {/* A phone gives the name its own row and puts Test and Save under it, so the name never shrinks away. */}
      <nav
        aria-label="Breadcrumb"
        className={`flex min-w-0 flex-1 items-center gap-1.5 text-[14px] ${phone ? 'basis-full' : ''}`}
      >
        <button
          type="button"
          onClick={onBack}
          className="touch-target-y relative shrink-0 rounded font-medium text-slate-500 transition hover:text-slate-900 motion-reduce:transition-none dark:text-slate-400 dark:hover:text-white"
        >
          Automations
        </button>
        <span aria-hidden className="text-slate-400">
          /
        </span>
        <input
          aria-label="Rule name"
          aria-invalid={nameFault ? true : undefined}
          value={body.name}
          maxLength={AUTOMATION_NAME_MAX}
          onChange={(e) => change({ ...body, name: e.target.value })}
          className={`min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 font-semibold text-slate-900 outline-none transition hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-200 motion-reduce:transition-none dark:text-slate-50 dark:hover:bg-slate-800 dark:focus:bg-slate-900 dark:focus:ring-brand-500/30 ${nameFault ? 'ring-2 ring-red-300 dark:ring-red-500/50' : ''}`}
        />
        {rule ? (
          <Switch
            size="sm"
            checked={rule.enabled}
            busy={toggling}
            label={rule.enabled ? 'On' : 'Off'}
            onChange={(next) => void toggle(next)}
          />
        ) : (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Off
          </span>
        )}
      </nav>
      {rule && !phone ? (
        <span className="text-[12px] text-slate-500 dark:text-slate-400">
          Edited by {rule.edited.by.name}
          {rule.edited.ai ? ' (Agent)' : ''} ·{' '}
          {formatRelativeTimeShort(Math.max(0, now - rule.edited.at))}
        </span>
      ) : null}
      <div className={`flex items-center gap-2 ${phone ? 'w-full justify-end' : ''}`}>
        <Button variant="secondary" size="xs" onClick={() => setTesting(true)}>
          Test on a Card
        </Button>
        <Button
          variant="primary"
          size="xs"
          onClick={() => void save()}
          disabled={saving || (!!rule && !dirty)}
        >
          {saving ? 'Saving…' : 'Save Rule'}
        </Button>
        {trailing}
      </div>
      {nameFault || otherFault ? (
        <p role="alert" className="w-full text-[12px] font-medium text-red-700 dark:text-red-300">
          {nameFault ?? otherFault}
        </p>
      ) : null}
    </div>
  );

  const steps = (
    <div className="flex flex-col gap-5">
      {notice}
      <RuleSteps
        body={body}
        outline={outline}
        selected={selected}
        fault={stepFault && fault ? { part: stepFault, message: fault.message } : null}
        actions={actions}
        picks={pickMarks}
      />
      <RuleDetails chain={body.chain} onChain={(chain) => change({ ...body, chain })} />
    </div>
  );
  const edited: ReactNode = rule ? (
    <>
      Edited by {rule.edited.by.name}
      {rule.edited.ai ? ' (Agent)' : ''} ·{' '}
      {formatRelativeTimeShort(Math.max(0, now - rule.edited.at))}
    </>
  ) : null;
  const panel = (
    <StepPanel
      body={body}
      part={selected}
      onChange={(next) => change(next)}
      outline={outline}
      faultPath={fault?.path ?? null}
      person={person}
      now={now}
      timeZone={timeZone}
      {...(phone ? { drawer: { onClose: () => setStepOpen(false) } } : {})}
    />
  );

  // An Incoming Webhook rule's parts read this: its address and secret are the saved rule's, as listed.
  const isIncoming = body.trigger.kind === 'incoming_webhook';
  const cardless = isIncoming && runsWithoutCard(body);
  const incoming = useMemo<IncomingRule>(
    () => ({
      incoming: isIncoming,
      ruleId: rule?.id ?? null,
      hook: rule?.trigger.kind === 'incoming_webhook' ? rule.hook : undefined,
      cardless,
      now,
    }),
    [isIncoming, rule, cardless, now],
  );

  return (
    <IncomingRuleProvider value={incoming}>
      <PlanWebhooksProvider value={webhooks}>
        <div data-rule-builder="" className="flex min-h-0 flex-1 flex-col">
          {phone ? (
            <>
              <PhoneRuleHeader
                name={body.name}
                onName={(name) => change({ ...body, name })}
                nameFault={nameFault}
                state={
                  rule
                    ? {
                        enabled: rule.enabled,
                        busy: toggling,
                        onToggle: (next) => void toggle(next),
                      }
                    : null
                }
                edited={edited}
                onBack={onBack}
              />
              <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain bg-slate-50/60 px-4 py-4 dark:bg-slate-950/40">
                {notice}
                <RuleSteps
                  body={body}
                  outline={outline}
                  selected={selected}
                  fault={stepFault && fault ? { part: stepFault, message: fault.message } : null}
                  actions={actions}
                  picks={pickMarks}
                />
              </div>
              <PhoneRuleFoot
                details={
                  <RuleDetails
                    placement="foot"
                    chain={body.chain}
                    onChain={(chain) => change({ ...body, chain })}
                  />
                }
                message={nameFault ?? otherFault}
                onTest={() => setTesting(true)}
                onSave={() => void save()}
                saving={saving}
                saved={!!rule && !dirty}
              />
              {stepOpen && selected ? panel : null}
            </>
          ) : (
            <>
              {bar}
              <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px]">
                <div className="min-h-0 overflow-y-auto bg-slate-50/60 px-6 py-5 dark:bg-slate-950/40">
                  {steps}
                </div>
                <div className="min-h-0 overflow-y-auto border-l border-slate-100 px-5 py-5 dark:border-slate-800">
                  {panel}
                </div>
              </div>
            </>
          )}
          {testing ? (
            <TestOnCard
              body={body}
              outline={outline}
              // Tried as it would save: in this browser's time zone.
              test={(tried, item) => api.test({ ...tried, timeZone }, item)}
              onRefused={refused}
              onClose={() => setTesting(false)}
            />
          ) : null}
        </div>
      </PlanWebhooksProvider>
    </IncomingRuleProvider>
  );
}
