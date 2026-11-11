'use client';

// The Automations screen (docs/specs/026-plan/automations.md "The Automations screen"): the header (Automations,
// what rules do, New Rule), the Rules · n and Run Log tabs with the Runs today meter, then the tab, or a rule's
// builder in its place. Full screen on a phone, its meter at the foot. Leaving a builder with unsaved changes asks
// Discard Changes? first, whether by the breadcrumb, a tab or the close.

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { AutomationListedRule } from '@liveplanner/api-schema';
import { AUTOMATION_RULES_MAX } from '@liveplanner/items';
import {
  Button,
  CompactEmptyState,
  DialogCloseButton,
  PlusIcon,
  useMediaQuery,
} from '@liveplanner/ui';
import { ConfirmDialog } from '@liveworkspace/workbench/components/dialogs/ConfirmDialog';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { track } from '@/lib/telemetry';
import { useToast } from '@/hooks/ui/useToast';
import { usePlan } from '@/components/plan/PlanContext';
import { useAutomationOutline } from './automation-outline';
import { BoltIcon } from './automation-glyphs';
import { AutomationRefusal, type AutomationsScope } from './automations-client';
import type { AutomationsTarget } from './AutomationsContext';
import { newRuleBody, nextRuleName } from './rule-draft';
import { RuleBuilder } from './RuleBuilder';
import { RulesEmpty } from './RulesEmpty';
import { RulesList } from './RulesList';
import { RunLog } from './RunLog';
import { RunsMeter } from './RunsMeter';
import { useAutomations } from './use-automations';

const MINUTE_MS = 60_000;

/** The clock the screen reads its "4 min ago"s from, a minute at a time. */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(t);
  }, []);
  return now;
}

const localZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const TAB =
  'touch-target-y relative -mb-px border-b-2 px-1 pb-2.5 pt-1 text-[13px] font-medium transition motion-reduce:transition-none';
const TAB_ON = 'border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300';
const TAB_OFF =
  'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100';

export function AutomationsDialog({
  scope,
  target,
  onTarget,
  onClose,
}: {
  scope: AutomationsScope;
  target: AutomationsTarget;
  onTarget: (next: AutomationsTarget) => void;
  onClose: () => void;
}) {
  const api = useAutomations(scope);
  const outline = useAutomationOutline();
  const plan = usePlan();
  const toast = useToast();
  const now = useMinuteClock();
  const phone = !useMediaQuery('(min-width: 640px)');
  const titleId = useId();
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [leaving, setLeaving] = useState<(() => void) | null>(null);
  const rules = useMemo(() => api.data?.rules ?? [], [api.data]);

  // Every way out of a dirty builder asks first.
  const guard = useCallback(
    (go: () => void) => () => {
      if (target.view === 'rule' && dirty) setLeaving(() => go);
      else go();
    },
    [target.view, dirty],
  );
  const close = guard(onClose);

  const withBusy = async (id: string, work: () => Promise<unknown>) => {
    setBusy((s) => new Set(s).add(id));
    try {
      await work();
    } finally {
      setBusy((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  };
  const failed = (what: string) => (error: unknown) => {
    debugLog(`[automations] ${what}.failed`, { error: String(error) });
    toast.error(
      error instanceof AutomationRefusal
        ? error.message
        : 'That didn’t work. Check your connection and try again.',
    );
  };

  const actionsFor = (rule: AutomationListedRule) => ({
    onOpen: () => onTarget({ view: 'rule', ruleId: rule.id }),
    onToggle: (enabled: boolean) =>
      void withBusy(rule.id, async () => {
        await api.toggle(rule.id, enabled);
        track('Plan', 'Toggled', enabled ? 'AutomationOn' : 'AutomationOff');
      }).catch(failed('toggle')),
    onDuplicate: () =>
      void api
        .duplicate(rule.id)
        .then((copy) => toast.success(`Made ${copy.name}`), failed('duplicate')),
    onRunLog: () => onTarget({ view: 'runs', ruleId: rule.id }),
    onDelete: () =>
      void api.remove(rule.id).then(() => {
        track('Plan', 'Deleted', 'AutomationRule');
        toast.info(`Deleted ${rule.name}`);
      }, failed('delete')),
  });

  const openCard = (cardId: string) => {
    onClose();
    plan?.openItem(cardId);
  };

  const newRule = () => onTarget({ view: 'rule', ruleId: null });
  const full = rules.length >= AUTOMATION_RULES_MAX;
  const editing = target.view === 'rule' ? target : null;
  const editingRule = editing?.ruleId ? (rules.find((r) => r.id === editing.ruleId) ?? null) : null;
  // Read once, as the builder mounts (its key changes with the rule).
  const initial = editingRule ?? newRuleBody(nextRuleName(rules.map((r) => r.name)), localZone());

  const meter = api.data ? (
    <RunsMeter used={api.data.runsToday} max={api.data.runsPerDay} stacked={phone} />
  ) : null;

  const body = (() => {
    if (api.status === 'refused')
      return (
        <CompactEmptyState
          role="status"
          icon={<BoltIcon size={18} />}
          title="Only an Editor Can See Rules"
          description="Ask whoever shared this plan for edit access to see and change its rules."
        />
      );
    if (api.status === 'error' && !api.data)
      return (
        <CompactEmptyState
          role="status"
          icon={<BoltIcon size={18} />}
          title="Couldn’t Load the Rules"
          description="Check your connection and try again."
          action={
            <Button variant="secondary" size="xs" onClick={api.reload}>
              Try Again
            </Button>
          }
        />
      );
    if (!api.data)
      return (
        <div role="status" aria-label="Loading rules" className="flex flex-col gap-2 px-5 py-4">
          {[0.7, 0.55, 0.62].map((o, i) => (
            <div
              key={i}
              style={{ opacity: o }}
              className="h-14 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none dark:bg-slate-800"
            />
          ))}
        </div>
      );
    if (target.view === 'runs')
      return (
        <RunLog
          key={target.ruleId ?? 'all'}
          scope={scope}
          rules={rules}
          now={now}
          phone={phone}
          initialRule={target.ruleId}
          onOpenCard={openCard}
        />
      );
    if (rules.length === 0) return <RulesEmpty onNew={newRule} />;
    return (
      <RulesList
        rules={rules}
        outline={outline}
        now={now}
        phone={phone}
        busyIds={busy}
        actionsFor={actionsFor}
      />
    );
  })();

  return (
    <Dialog
      open
      onClose={close}
      titleId={titleId}
      size="3xl"
      className="flex flex-col overflow-hidden sm:h-[min(52rem,calc(100dvh-2rem))] sm:w-[min(67.5rem,calc(100vw-2rem))] sm:max-w-none max-h-[calc(100dvh-2rem)] max-sm:h-dvh max-sm:max-h-dvh"
    >
      <h2 id={titleId} className="sr-only">
        Automations
      </h2>
      {editing && api.data ? (
        <RuleBuilder
          key={editing.ruleId ?? 'new'}
          rule={editingRule}
          initial={initial}
          outline={outline}
          api={api}
          person={plan?.self?.name ?? 'You'}
          now={now}
          phone={phone}
          onDirty={setDirty}
          onBack={guard(() => onTarget({ view: 'rules' }))}
          onSaved={(rule) => onTarget({ view: 'rule', ruleId: rule.id })}
          trailing={<DialogCloseButton onClick={close} />}
        />
      ) : (
        <>
          <header
            className={`flex items-start gap-3 ${phone ? 'px-4 pb-2 pt-4' : 'px-6 pb-3 pt-5'}`}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span aria-hidden className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                Automations
              </span>
              {phone ? null : (
                <p className="text-[13px] text-slate-500 dark:text-slate-400">
                  Rules that act on this plan’s cards for you when something happens.
                </p>
              )}
            </div>
            <Button variant="primary" size="xs" onClick={newRule} disabled={!api.data || full}>
              <PlusIcon size={12} />
              New Rule
            </Button>
            <DialogCloseButton onClick={close} />
          </header>
          <div
            role="tablist"
            aria-label="Automations"
            className={`flex items-end gap-5 border-b border-slate-100 dark:border-slate-800 ${phone ? 'px-4' : 'px-6'}`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={target.view === 'rules'}
              onClick={() => onTarget({ view: 'rules' })}
              className={`${TAB} ${target.view === 'rules' ? TAB_ON : TAB_OFF}`}
            >
              Rules{api.data ? ` · ${rules.length}` : ''}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={target.view === 'runs'}
              onClick={() => onTarget({ view: 'runs' })}
              className={`${TAB} ${target.view === 'runs' ? TAB_ON : TAB_OFF}`}
            >
              Run Log
            </button>
            <span className="flex-1" />
            {phone ? null : <div className="pb-2">{meter}</div>}
          </div>
          <div role="tabpanel" className="flex min-h-0 flex-1 flex-col">
            {body}
          </div>
          {phone && meter ? (
            <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">{meter}</div>
          ) : null}
        </>
      )}
      {leaving ? (
        <ConfirmDialog
          open
          title="Discard Changes?"
          message="This rule has changes that aren’t saved. Leaving drops them."
          confirmLabel="Discard Changes"
          cancelLabel="Keep Editing"
          onCancel={() => setLeaving(null)}
          onConfirm={() => {
            const go = leaving;
            setLeaving(null);
            setDirty(false);
            go();
          }}
        />
      ) : null}
    </Dialog>
  );
}
