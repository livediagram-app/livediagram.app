'use client';

// The rule builder (liveplanner/docs/specs/026-plan/automations.md "The rule builder"; blueprint ui.md "The
// builder"): the bar (the breadcrumb back to Automations, the name editable in place, the On / Off chip, "Edited by …
// · when", the test, Save Rule), the steps on the left and the selected step's panel on the right, and Rule Details
// under the steps; on a phone the rule drawer's ("The rule builder on a phone"): PhoneRuleHeader, the steps
// scrolling, PhoneRuleFoot with Rule Details pinned, and the picked step's panel in its own drawer (StepDrawer). It
// holds the rule as changed; the dialog asks Discard Changes? before leaving it dirty (onDirty). A refusal's `path`
// marks the step at fault and selects it. A rule opened from a template (or drafted by Describe a Rule, with its
// `notice` above the steps) marks the steps it left to pick until they are picked. It holds the item's connections
// for its message steps, read once when one first opens, and tells the screen the rule as it stands (keepDraft), so
// Add a Connection… and an app's round trip can come back to it. A save stamps the rule with this browser's time
// zone, the saver's.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AUTOMATION_NAME_MAX, type AutomationTemplatePickAt } from '@liveworkspace/automations';
import { Button, Switch, formatRelativeTimeShort } from '@liveworkspace/ui';
import { useToast } from '@liveworkspace/workbench/hooks/ui/useToast';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { AutomationRefusal } from './automations-client';
import { ItemConnectionsProvider, useItemConnectionsState } from './item-connections';
import type { AutomationsScope } from './kit';
import { useAutomationsKit, useAutomationsScreen, type KeptRule } from './kit-context';
import { PhoneRuleFoot, PhoneRuleHeader, RULE_SWITCH_NAME } from './PhoneRuleChrome';
import { refusalWords } from './refusal-words';
import { RuleContextProvider, type RuleContext } from './rule-context';
import {
  addAction,
  addCondition,
  addIfElse,
  addStep,
  bodyOf,
  editPart,
  partAt,
  sameBody,
  samePart,
  type RulePart,
} from './rule-draft';
import { RuleDetails } from './RuleDetails';
import { CrossAppRuleCard } from './cross-app/CrossAppRuleCard';
import { RuleSteps, type StepsActions } from './RuleSteps';
import { StepPanel } from './StepPanel';
import type { ListedRule, RuleBody } from './types';
import type { AutomationsApi } from './use-automations';

// A rule with nothing left to pick: one list, so the screen is told of the rule again only when it changes.
const NO_PICKS: readonly AutomationTemplatePickAt[] = [];

type Fault = { path: string; message: string };

export function RuleBuilder({
  rule,
  initial,
  resume,
  outline,
  api,
  now,
  phone,
  onBack,
  onSaved,
  onDirty,
  trailing,
  picks = NO_PICKS,
  blank = false,
  timeZone,
  scope,
  signedIn = false,
  notice,
}: {
  // The saved rule, or null for one not saved yet.
  rule: ListedRule | null;
  // What the builder starts from: the saved rule's body, or a new rule's.
  initial: RuleBody;
  // A rule kept from before (Back to Rule, an app's round trip): it opens as it was left, on the step that was open.
  resume?: KeptRule | undefined;
  outline: unknown;
  api: Pick<AutomationsApi, 'save' | 'toggle' | 'test'>;
  now: number;
  phone: boolean;
  onBack: () => void;
  onSaved: (rule: ListedRule) => void;
  onDirty: (dirty: boolean) => void;
  // The dialog's close, at the bar's end.
  trailing?: React.ReactNode;
  // What the template it was opened from left to pick.
  picks?: readonly AutomationTemplatePickAt[] | undefined;
  // A New Rule, started blank: left untouched, it leaves without Discard Changes?.
  blank?: boolean;
  // This browser's time zone: the rule is saved in it.
  timeZone: string;
  // The item, for its connections; and whether the person is signed in (connections are an account's).
  scope: AutomationsScope;
  signedIn?: boolean;
  // A note above the steps: Drafted by AI, for a rule Describe a Rule drafted.
  notice?: React.ReactNode;
}) {
  const kit = useAutomationsKit();
  const { track, words } = kit.plumbing;
  const screen = useAutomationsScreen();
  const toast = useToast();
  const connections = useItemConnectionsState({
    client: kit.connections.client,
    scope,
    signedIn,
    openTab: screen?.openConnections,
  });
  const [saved, setSaved] = useState(() => bodyOf(initial));
  const [body, setBody] = useState(() => bodyOf(resume?.body ?? initial));
  const [selected, setSelected] = useState<RulePart | null>(resume?.part ?? { part: 'trigger' });
  // A phone's step drawer: opened by a pick, an add or a refusal, never by the first selection; a rule come back to
  // opens on the step it was left on.
  const [stepOpen, setStepOpen] = useState(!!resume?.part);
  // The step a Move Up or Move Down just moved: its ⋯ takes focus once it is drawn in its new place.
  const [moved, setMoved] = useState<RulePart | null>(null);
  const [fault, setFault] = useState<Fault | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [testing, setTesting] = useState(false);
  const dirty = !rule || !sameBody(body, saved);
  // A saved rule with nothing changed: nothing to save.
  const unchanged = !!rule && !dirty;
  // Leaving asks first while there is work to lose: a New Rule left as it opened has none (a template's or a draft's
  // start does, so it still asks).
  const unsaved = dirty && !(blank && sameBody(body, saved));
  useEffect(() => onDirty(unsaved), [unsaved, onDirty]);
  // The rule as it stands, for the screen to keep while the person is away from it.
  const keepDraft = screen?.keepDraft;
  const ruleId = rule?.id ?? null;
  useEffect(() => {
    if (!keepDraft) return;
    keepDraft({ ruleId, body: { ...body, timeZone }, picks, part: selected });
    return () => keepDraft(null);
  }, [keepDraft, ruleId, body, timeZone, picks, selected]);
  const pickMarks = useMemo(
    () =>
      new Map(kit.sentence.picksLeft(body, picks).map((p) => [p.path, kit.sentence.pick(p.pick)])),
    [kit, body, picks],
  );

  const change = (next: RuleBody, part?: RulePart | null) => {
    setBody(next);
    if (part !== undefined) {
      setSelected(part);
      setStepOpen(part !== null);
    }
    setFault(null);
  };

  const said = (r: AutomationRefusal) => refusalWords(r, words.item, kit.sentence.refusalPicks);

  const refused = (r: AutomationRefusal) => {
    const path = r.path ?? (r.code === 'automation_name_taken' ? 'name' : '');
    setFault({ path, message: said(r) });
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
      if (!rule) track('rule_created', body.trigger.kind);
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
      track(enabled ? 'rule_on' : 'rule_off');
    } catch (error) {
      debugLog('[automations] toggle.failed', { error: String(error) });
      toast.error(
        error instanceof AutomationRefusal ? said(error) : 'The rule didn’t change. Try again.',
      );
    } finally {
      setToggling(false);
    }
  };

  // A time trigger, an incoming webhook or an email has nobody of the item behind it.
  const personless = !!kit.kinds.triggers[body.trigger.kind]?.personless;
  const actions: StepsActions = {
    select: (part) => {
      setSelected(part);
      setStepOpen(true);
    },
    edit: (part, edit) => {
      const next = editPart(body, part, edit);
      change(next.body, next.part);
      // A move keeps the steps in sight (a phone's drawer stays closed), focus on the moved step's ⋯ (the cards are
      // drawn by position, so the menu's own focus return lands on whichever step took its place); a duplicate is an
      // added step, and opens.
      if (edit === 'up' || edit === 'down') {
        setStepOpen(false);
        setMoved(next.part);
      }
    },
    addCondition: (kind, ifStep) => {
      const condition = kit.kinds.conditions[kind]?.fresh(outline);
      if (!condition) return;
      const next = addCondition(body, condition, ifStep);
      change(next.body, next.part);
    },
    addAction: (key, branch) => {
      const kind = kit.kinds.actions[key];
      if (!kind) return;
      const next = addAction(body, kind.fresh(outline, { personless }), branch, !!kind.top);
      change(next.body, next.part);
    },
    addIfElse: () => {
      const next = addIfElse(body);
      change(next.body, next.part);
    },
    addBranch: () => {
      const branch = kit.kinds.branch;
      if (!branch) return;
      const next = addStep(body, branch.fresh(outline));
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
            label={RULE_SWITCH_NAME}
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
          {words.test}
        </Button>
        {/* Busy while it saves and only marked unavailable once saved (busy-buttons.md): a disabled button would drop
            the keyboard to the dialog, away from the refusal or the toast it just raised. */}
        <Button
          variant="primary"
          size="xs"
          onClick={() => {
            if (!unchanged) void save();
          }}
          busy={saving}
          aria-disabled={unchanged || undefined}
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

  const ruleSteps = (
    <RuleSteps
      body={body}
      outline={outline}
      selected={selected}
      fault={stepFault && fault ? { part: stepFault, message: fault.message } : null}
      actions={actions}
      picks={pickMarks}
      moved={moved}
      onMovedFocused={() => setMoved(null)}
    />
  );
  // Steps in other apps: who they act as, what they reach, their limits (cross-app/CrossAppRuleCard.tsx).
  const crossCard = (
    <CrossAppRuleCard
      body={body}
      author={rule ? rule.edited.by.name : null}
      onRuns={rule && screen?.openRuns ? () => screen.openRuns?.(rule.id) : undefined}
    />
  );
  const steps = (
    <div className="flex flex-col gap-5">
      {notice}
      {ruleSteps}
      {crossCard}
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
      now={now}
      timeZone={timeZone}
      {...(phone
        ? {
            drawer: {
              onClose: () => setStepOpen(false),
              fault: stepFault && fault && samePart(stepFault, selected) ? fault.message : null,
            },
          }
        : {})}
    />
  );

  // An Incoming Webhook rule's parts read this: its address and secret are the saved rule's, as listed.
  const isIncoming = body.trigger.kind === 'incoming_webhook';
  const context = useMemo<RuleContext>(
    () => ({
      body,
      incoming: isIncoming,
      ruleId: rule?.id ?? null,
      hook: rule?.trigger.kind === 'incoming_webhook' ? rule.hook : undefined,
      now,
    }),
    [body, isIncoming, rule, now],
  );
  const Test = kit.Test;
  const Around = kit.BuilderProvider;

  const built = (
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
            {ruleSteps}
            {crossCard}
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
            testLabel={words.test}
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
        <Test
          body={body}
          outline={outline}
          // Tried as it would save: in this browser's time zone.
          test={(tried, subject) => api.test({ ...tried, timeZone }, subject)}
          onRefused={refused}
          onClose={() => setTesting(false)}
        />
      ) : null}
    </div>
  );

  return (
    <RuleContextProvider value={context}>
      <ItemConnectionsProvider value={connections}>
        {Around ? <Around scope={scope}>{built}</Around> : built}
      </ItemConnectionsProvider>
    </RuleContextProvider>
  );
}
