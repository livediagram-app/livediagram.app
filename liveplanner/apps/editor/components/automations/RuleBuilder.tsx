'use client';

// The rule builder (docs/specs/026-plan/automations.md "The rule builder"): the bar (the breadcrumb back to
// Automations, the name editable in place, the On / Off chip, "Edited by … · when", Test on a Card, Save Rule), the
// steps on the left and the selected step's panel on the right (under the steps on a phone), and Rule Details under
// the steps. It holds the rule as changed; the dialog asks Discard Changes? before leaving it dirty (onDirty). A
// refusal's `path` marks the step at fault and selects it.

import { useEffect, useState } from 'react';
import type { AutomationListedRule } from '@liveplanner/api-schema';
import type { AutomationRuleBody } from '@liveplanner/items';
import { AUTOMATION_NAME_MAX } from '@liveplanner/items';
import { Button, Switch, formatRelativeTimeShort } from '@liveplanner/ui';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { track } from '@/lib/telemetry';
import { useToast } from '@/hooks/ui/useToast';
import type { AutomationOutline } from './automation-outline';
import { AutomationRefusal } from './automations-client';
import {
  addAction,
  addCondition,
  addIfElse,
  bodyOf,
  editPart,
  partAt,
  sameBody,
  type RulePart,
} from './rule-draft';
import { RuleDetails } from './RuleDetails';
import { RuleSteps, type StepsActions } from './RuleSteps';
import { defaultAction, defaultCondition } from './step-defaults';
import { StepPanel } from './StepPanel';
import { TestOnCard } from './TestOnCard';
import type { AutomationsApi } from './use-automations';

type Fault = { path: string; message: string };

const REFUSAL_WORDS: Readonly<Record<string, string>> = {
  automation_name_taken: 'Another rule here has this name. Pick another.',
  automation_rules_full: 'This plan has 50 rules, the most it can hold. Delete one to add another.',
  automation_value_unknown: 'This names a value rules don’t know. Pick one under Insert a Value.',
  automation_not_found: 'This rule was deleted elsewhere.',
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
}) {
  const toast = useToast();
  const [saved, setSaved] = useState(() => bodyOf(initial));
  const [body, setBody] = useState(() => bodyOf(initial));
  const [selected, setSelected] = useState<RulePart | null>({ part: 'trigger' });
  const [fault, setFault] = useState<Fault | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [testing, setTesting] = useState(false);
  const dirty = !rule || !sameBody(body, saved);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  const change = (next: AutomationRuleBody, part?: RulePart | null) => {
    setBody(next);
    if (part !== undefined) setSelected(part);
    setFault(null);
  };

  const refused = (r: AutomationRefusal) => {
    const path = r.path ?? (r.code === 'automation_name_taken' ? 'name' : '');
    setFault({ path, message: refusalMessage(r) });
    const part = path ? partAt(body, path) : null;
    if (part) setSelected(part);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const next = await api.save(rule?.id ?? null, body);
      if (!rule) track('Plan', 'Created', 'AutomationRule');
      setSaved(bodyOf(next));
      setBody(bodyOf(next));
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
    select: (part) => setSelected(part),
    edit: (part, edit) => {
      const next = editPart(body, part, edit);
      change(next.body, next.part);
    },
    addCondition: (kind, ifStep) => {
      const next = addCondition(body, defaultCondition(kind, outline), ifStep);
      change(next.body, next.part);
    },
    addAction: (kind, branch) => {
      const next = addAction(body, defaultAction(kind, outline), branch);
      change(next.body, next.part);
    },
    addIfElse: () => {
      const next = addIfElse(body);
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
          Edited by {rule.edited.by.name} ·{' '}
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
      <RuleSteps
        body={body}
        outline={outline}
        selected={selected}
        fault={stepFault && fault ? { part: stepFault, message: fault.message } : null}
        actions={actions}
      />
      <RuleDetails chain={body.chain} onChain={(chain) => change({ ...body, chain })} />
    </div>
  );
  const panel = (
    <StepPanel
      body={body}
      part={selected}
      onChange={(next) => change(next)}
      outline={outline}
      faultPath={fault?.path ?? null}
      person={person}
      now={now}
    />
  );

  return (
    <div data-rule-builder="" className="flex min-h-0 flex-1 flex-col">
      {bar}
      {phone ? (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
          {steps}
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            {panel}
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-h-0 overflow-y-auto bg-slate-50/60 px-6 py-5 dark:bg-slate-950/40">
            {steps}
          </div>
          <div className="min-h-0 overflow-y-auto border-l border-slate-100 px-5 py-5 dark:border-slate-800">
            {panel}
          </div>
        </div>
      )}
      {testing ? (
        <TestOnCard
          body={body}
          outline={outline}
          test={api.test}
          onRefused={refused}
          onClose={() => setTesting(false)}
        />
      ) : null}
    </div>
  );
}
