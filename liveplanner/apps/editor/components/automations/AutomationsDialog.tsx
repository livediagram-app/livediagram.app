'use client';

// The Automations screen (docs/specs/026-plan/automations.md "The Automations screen"): the header (Automations,
// what rules do, New Rule), the Rules · n, Audit Trail and Templates tabs with the Runs today meter, then the tab, or a
// rule's builder in its place. Full screen on a phone, its meter at the foot. Leaving a builder with unsaved changes
// asks Discard Changes? first, whether by the breadcrumb, a tab or the close. A template picked opens the builder
// filled from the plan, unsaved and off, named uniquely. The plan's Webhooks dialog opens over it, for Fix Webhook
// and an outgoing action's Add a Webhook….

import { useCallback, useId, useMemo, useRef, useState } from 'react';
import type { AutomationListedRule } from '@liveplanner/api-schema';
import {
  AUTOMATION_RULES_MAX,
  automationTemplate,
  freeRuleName,
  type AutomationRuleBody,
  type AutomationTemplateId,
  type AutomationTemplatePickAt,
} from '@liveplanner/items';
import { CompactEmptyState, Button, DialogCloseButton, useMediaQuery } from '@liveplanner/ui';
import { ConfirmDialog } from '@liveworkspace/workbench/components/dialogs/ConfirmDialog';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { ItemWebhooksDialog } from '@liveworkspace/workbench/components/dialogs/ItemWebhooksDialog';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { track } from '@/lib/telemetry';
import { useToast } from '@/hooks/ui/useToast';
import { usePlan } from '@/components/plan/PlanContext';
import { useAutomationOutline } from './automation-outline';
import { BoltIcon } from './automation-glyphs';
import { AutomationRefusal, type AutomationsScope } from './automations-client';
import { automationsHeroArt } from './AutomationsHeroArt';
import type { AutomationsTarget } from './AutomationsContext';
import type { AutomationOutline } from './automation-outline';
import { NewRuleMenu } from './NewRuleMenu';
import { newRuleBody, nextRuleName } from './rule-draft';
import { RuleBuilder } from './RuleBuilder';
import { RulesEmpty } from './RulesEmpty';
import { RulesList } from './RulesList';
import { RunLog } from './RunLog';
import { RunsMeter } from './RunsMeter';
import { localZone, useMinuteClock } from './screen-clock';
import { ScreenTabs } from './ScreenTabs';
import { TemplatesGallery } from './TemplatesGallery';
import { useAutomations } from './use-automations';

/** A template's rule over this plan, named so no rule here has its name, and what it left to pick. */
export function templateStart(
  id: AutomationTemplateId,
  outline: Pick<AutomationOutline, 'columns' | 'phases' | 'types'>,
  rules: readonly { id: string; name: string }[],
  timeZone: string,
): { body: AutomationRuleBody; picks: AutomationTemplatePickAt[] } | null {
  const template = automationTemplate(id);
  if (!template) return null;
  const { body, picks } = template.build({
    statuses: outline.columns,
    phases: outline.phases,
    types: outline.types,
    timeZone,
  });
  return { body: { ...body, name: freeRuleName(body.name, rules) }, picks };
}

export function AutomationsDialog({
  scope,
  target,
  onTarget,
  onClose,
  planName = '',
  signedIn = false,
}: {
  scope: AutomationsScope;
  target: AutomationsTarget;
  onTarget: (next: AutomationsTarget) => void;
  onClose: () => void;
  // The plan's name, for its Webhooks dialog's title.
  planName?: string;
  // Webhooks are an account's: a guest is told to sign in to pick one.
  signedIn?: boolean;
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
  // The plan's Webhooks dialog, open over the screen, and what to do once it closes (read the list again).
  const [webhooksOpen, setWebhooksOpen] = useState(false);
  const webhooksClosed = useRef<(() => void) | null>(null);
  const openWebhooks = useCallback((onClosed?: () => void) => {
    webhooksClosed.current = onClosed ?? null;
    setWebhooksOpen(true);
  }, []);
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
    onFixWebhook: () => openWebhooks(),
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
  const pickTemplate = (id: AutomationTemplateId) => {
    track('UI', 'Opened', `AutomationTemplate.${id}`);
    onTarget({ view: 'rule', ruleId: null, template: id });
  };
  const full = rules.length >= AUTOMATION_RULES_MAX;
  const zone = localZone();
  const editing = target.view === 'rule' ? target : null;
  const editingRule = editing?.ruleId ? (rules.find((r) => r.id === editing.ruleId) ?? null) : null;
  const fromTemplate =
    editing && !editing.ruleId && editing.template
      ? templateStart(editing.template, outline, rules, zone)
      : null;
  // Read once, as the builder mounts (its key changes with the rule).
  const initial =
    editingRule ?? fromTemplate?.body ?? newRuleBody(nextRuleName(rules.map((r) => r.name)), zone);

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
    if (target.view === 'templates')
      return (
        <div className={`min-h-0 flex-1 overflow-y-auto ${phone ? 'px-4 py-4' : 'px-6 py-5'}`}>
          {full ? (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              This plan has 50 rules, the most it can hold. Delete one to add another.
            </p>
          ) : null}
          <p className="mb-4 text-[13px] text-slate-500 dark:text-slate-400">
            Pick one to open it in the builder, filled in from this plan. Nothing is saved until you
            save the rule.
          </p>
          <TemplatesGallery onPick={pickTemplate} heading="All Templates" disabled={full} />
        </div>
      );
    if (rules.length === 0) return <RulesEmpty onNew={newRule} onTemplate={pickTemplate} />;
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
      {editing && api.data ? (
        <>
          {/* The builder's breadcrumb stands where the header was; the dialog keeps its name for screen readers. */}
          <h2 id={titleId} className="sr-only">
            Automations
          </h2>
          <RuleBuilder
            key={editing.ruleId ?? (editing.template ? `template:${editing.template}` : 'new')}
            rule={editingRule}
            initial={initial}
            picks={fromTemplate?.picks}
            timeZone={zone}
            scope={scope}
            signedIn={signedIn}
            onOpenWebhooks={openWebhooks}
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
        </>
      ) : (
        <>
          {/* The dialog hero header, drawn for rules (automations.md "The Automations screen"). */}
          <HeroDialogHeader
            art={automationsHeroArt}
            titleId={titleId}
            title="Automations"
            subtitle="Rules that act on this plan’s cards for you when something happens."
            actions={
              <NewRuleMenu
                disabled={!api.data || full}
                onBlank={newRule}
                onTemplates={() => onTarget({ view: 'templates' })}
              />
            }
            onClose={close}
          />
          <ScreenTabs
            current={target.view === 'rule' ? 'rules' : target.view}
            rules={api.data ? rules.length : null}
            phone={phone}
            meter={meter}
            onTab={(tab) => onTarget({ view: tab })}
          />
          <div role="tabpanel" className="flex min-h-0 flex-1 flex-col">
            {body}
          </div>
          {phone && meter ? (
            <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">{meter}</div>
          ) : null}
        </>
      )}
      <ItemWebhooksDialog
        open={webhooksOpen}
        onClose={() => {
          setWebhooksOpen(false);
          webhooksClosed.current?.();
          webhooksClosed.current = null;
        }}
        itemId={scope.projectId}
        app="liveplanner"
        title={planName}
        shareCode={scope.shareCode}
      />
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
