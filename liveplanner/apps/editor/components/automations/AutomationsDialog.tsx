'use client';

// The Automations screen (docs/specs/026-plan/automations.md "The Automations screen"): the header (Automations,
// what rules do, New Rule), the Rules · n, Audit Trail and Templates tabs with the Runs today meter, then the tab, or a
// rule's builder in its place. Full screen on a phone, its meter at the foot. Leaving a builder with unsaved changes
// asks Discard Changes? first, whether by the breadcrumb, a tab or the close. A template picked opens the builder
// filled from the plan, unsaved and off, named uniquely. The plan's Webhooks dialog opens over it, for Fix Webhook
// and an outgoing action's Add a Webhook…. Where the deployment has liveplanner's GitHub App, a GitHub button in the
// header opens the GitHub view in the tab's place (automations.md "The GitHub view"), as a GitHub trigger's panel does.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
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
import { useCapabilities } from '@/hooks/persistence/useCapabilities';
import { useAutomationOutline } from './automation-outline';
import { BoltIcon } from './automation-glyphs';
import { AutomationRefusal, draftRule, type AutomationsScope } from './automations-client';
import { automationsHeroArt } from './AutomationsHeroArt';
import type { AutomationsTarget } from './AutomationsContext';
import { GithubAutomationsContext, type GithubAutomations } from './github/github-automations';
import { GithubButton } from './github/GithubButton';
import type { KeptRule } from './github/github-hash';
import { GITHUB_RULE_WORDS } from './github/github-return';
import { GithubView } from './github/GithubView';
import type { AutomationOutline } from './automation-outline';
import { NewRuleMenu } from './NewRuleMenu';
import { newRuleBody, nextRuleName } from './rule-draft';
import { RuleBuilder } from './RuleBuilder';
import { RuleDrawer } from './RuleDrawer';
import { RulesEmpty } from './RulesEmpty';
import { RulesList } from './RulesList';
import { RefreshButton, REFRESH_FAILED } from './RefreshButton';
import { RunLog, type RunLogReload } from './RunLog';
import { RunsMeter } from './RunsMeter';
import { localZone, useMinuteClock } from './screen-clock';
import { ScreenTabs, screenPanelId, screenTabId } from './ScreenTabs';
import { TemplatesGallery } from './TemplatesGallery';
import { DescribeRuleDialog } from './DescribeRuleDialog';
import { DraftedNote } from './DraftedNote';
import { readAutomations, useAutomations } from './use-automations';

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
  // Each opening reads the list again, so Last Run, This Week and Runs today are fresh (the list read for the footer's
  // dot, or by an earlier opening, keeps showing meanwhile). A read already under way is not repeated. `fresh` once this
  // opening's read settles: until then a rule the list lacks may be one made since, never yet called deleted. Kept as
  // the scope it settled for, so a scope changed while open waits for its own read.
  const [freshFor, setFreshFor] = useState<AutomationsScope | null>(null);
  const fresh = freshFor === scope;
  useEffect(() => {
    let live = true;
    void readAutomations(scope).then(() => {
      if (live) setFreshFor(scope);
    });
    return () => {
      live = false;
    };
  }, [scope]);
  // Refresh (beside the meter): the list and the open Audit Trail read again, one press at a time. It only reads, so
  // a rule open in the builder keeps its unsaved changes (the builder reads its rule once, as it mounts).
  const runsReload = useRef<RunLogReload | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const outline = useAutomationOutline();
  const plan = usePlan();
  const toast = useToast();
  const now = useMinuteClock();
  const phone = !useMediaQuery('(min-width: 640px)');
  const titleId = useId();
  const tabsId = useId();
  // The open tab: a rule's builder and the GitHub view sit under Rules.
  const screenTab = target.view === 'rule' || target.view === 'github' ? 'rules' : target.view;
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
  // GitHub, from the one capabilities read the editor shares; the connection itself is read by the GitHub view and a
  // GitHub trigger's panel, as they open.
  const { githubEnabled } = useCapabilities();
  const githubDraft = useRef<KeptRule | null>(null);
  // Describe a Rule: its dialog, and the rule it drafted (numbered, so each draft mounts the builder afresh).
  const [describing, setDescribing] = useState(false);
  const [drafted, setDrafted] = useState<{
    body: AutomationRuleBody;
    picks: AutomationTemplatePickAt[];
    n: number;
  } | null>(null);

  // Every way out of a dirty builder asks first.
  const guard = useCallback(
    (go: () => void) => () => {
      if (target.view === 'rule' && dirty) setLeaving(() => go);
      else go();
    },
    [target.view, dirty],
  );
  const close = guard(onClose);
  // The phone's rule drawer asks before any way out while the rule has unsaved changes, and stays open meanwhile.
  const backToRules = useCallback(() => onTarget({ view: 'rules' }), [onTarget]);
  const drawerMayClose = () => {
    if (!dirty) return true;
    setLeaving(() => backToRules);
    return false;
  };
  const openGithub = useMemo(() => guard(() => onTarget({ view: 'github' })), [guard, onTarget]);
  const github = useMemo<GithubAutomations>(
    () => ({
      enabled: githubEnabled,
      scope,
      openView: openGithub,
      draft: () => githubDraft.current,
      keepDraft: (kept) => {
        githubDraft.current = kept;
      },
    }),
    [githubEnabled, scope, openGithub],
  );
  // Back at the rule kept for the round trip to GitHub: say how it went, once.
  const backFromGithub = target.view === 'rule' ? target.github : undefined;
  useEffect(() => {
    if (!backFromGithub) return;
    if (backFromGithub === 'connected') toast.success(GITHUB_RULE_WORDS.connected);
    else toast.error(GITHUB_RULE_WORDS[backFromGithub]);
  }, [backFromGithub, toast]);

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
  const describe = () => {
    track('UI', 'Opened', 'AutomationDescribe');
    setDescribing(true);
  };
  const openDraft = (d: { rule: AutomationRuleBody; picks: AutomationTemplatePickAt[] }) => {
    track('Plan', 'Created', 'AutomationDraft');
    setDescribing(false);
    setDrafted((was) => ({ body: d.rule, picks: d.picks, n: (was?.n ?? 0) + 1 }));
    onTarget({ view: 'rule', ruleId: null, draft: true });
  };
  const editing = target.view === 'rule' ? target : null;
  const fromDraft = editing && !editing.ruleId && editing.draft ? drafted : null;
  const editingRule = editing?.ruleId ? (rules.find((r) => r.id === editing.ruleId) ?? null) : null;
  // A rule opened by its id (a comment's link to it) that the list lacks opens no builder, never a blank new rule.
  const ruleAbsent = !!editing?.ruleId && !editingRule;
  // Before this opening's read lands (or while it is read again): wait for it (a rule made since the list was read).
  const ruleWaiting = ruleAbsent && (!fresh || api.status === 'loading');
  // Said deleted only once a read has answered without it; a failed read says it failed.
  const ruleGone = ruleAbsent && !ruleWaiting && !!api.data && api.status === 'ready';
  // Built once per template opened (and as the plan's columns or rules change), so its picks are one list.
  const startTemplate = editing && !editing.ruleId ? editing.template : undefined;
  const fromTemplate = useMemo(
    () => (startTemplate ? templateStart(startTemplate, outline, rules, zone) : null),
    [startTemplate, outline, rules, zone],
  );
  // Read once, as the builder mounts (its key changes with the rule).
  const initial =
    editingRule ??
    editing?.kept?.body ??
    fromDraft?.body ??
    fromTemplate?.body ??
    newRuleBody(nextRuleName(rules.map((r) => r.name)), zone);

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    void Promise.all([readAutomations(scope), runsReload.current?.() ?? true]).then(
      ([rulesRead, runsRead]) => {
        setRefreshing(false);
        if (!rulesRead || !runsRead) toast.error(REFRESH_FAILED);
      },
    );
  };
  const meter = api.data ? (
    <div className={`flex items-center ${phone ? 'gap-2' : 'gap-1.5'}`}>
      <div className={phone ? 'min-w-0 flex-1' : undefined}>
        <RunsMeter used={api.data.runsToday} max={api.data.runsPerDay} stacked={phone} />
      </div>
      <RefreshButton busy={refreshing} onRefresh={refresh} />
    </div>
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
    if (api.status === 'error' && (!api.data || (ruleAbsent && !ruleWaiting)))
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
    if (!api.data || ruleWaiting)
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
    if (ruleGone)
      return (
        <CompactEmptyState
          role="status"
          icon={<BoltIcon size={18} />}
          title="This Rule Was Deleted"
          description="It’s no longer in this plan. Its runs stay in the Audit Trail until they age out."
          action={
            <Button variant="secondary" size="xs" onClick={() => onTarget({ view: 'rules' })}>
              Back to Rules
            </Button>
          }
        />
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
          reloadRef={runsReload}
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
    if (rules.length === 0)
      return <RulesEmpty onNew={newRule} onTemplate={pickTemplate} onDescribe={describe} />;
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

  const builder = editing ? (
    <RuleBuilder
      key={
        editing.ruleId ??
        (editing.kept
          ? 'github'
          : fromDraft
            ? `draft:${fromDraft.n}`
            : editing.template
              ? `template:${editing.template}`
              : 'new')
      }
      rule={editingRule}
      initial={initial}
      blank={!editing.ruleId && !editing.kept && !fromDraft && !editing.template}
      picks={fromDraft?.picks ?? fromTemplate?.picks ?? editing?.kept?.picks}
      notice={fromDraft ? <DraftedNote /> : undefined}
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
  ) : null;
  const listScreen = (
    <>
      {/* The dialog hero header, drawn for rules (automations.md "The Automations screen"). */}
      <HeroDialogHeader
        art={automationsHeroArt}
        titleId={titleId}
        title="Automations"
        subtitle="Rules that act on this plan’s cards for you when something happens."
        actions={
          <>
            {githubEnabled ? <GithubButton phone={phone} onOpen={openGithub} /> : null}
            <NewRuleMenu
              disabled={!api.data || full}
              onBlank={newRule}
              onTemplates={() => onTarget({ view: 'templates' })}
              onDescribe={describe}
            />
          </>
        }
        onClose={close}
        // The art's centre clears the wider actions when GitHub's button stands beside New Rule.
        className={githubEnabled ? '[--hero-centre-end:18rem]' : undefined}
      />
      <ScreenTabs
        idPrefix={tabsId}
        current={screenTab}
        rules={api.data ? rules.length : null}
        phone={phone}
        meter={meter}
        onTab={(tab) => onTarget({ view: tab })}
      />
      <div
        role="tabpanel"
        id={screenPanelId(tabsId)}
        aria-labelledby={screenTabId(tabsId, screenTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* The plan spent its runs for the day (spec "Runs, limits and loops"): the meter is full and says why. */}
        {api.data && api.data.runsToday >= api.data.runsPerDay ? (
          <p
            role="status"
            data-runs-full=""
            className={`mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300 ${phone ? 'mx-4' : 'mx-6'}`}
          >
            Daily limit reached: rules run again tomorrow
          </p>
        ) : null}
        {body}
      </div>
      {phone && meter ? (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">{meter}</div>
      ) : null}
    </>
  );

  return (
    <GithubAutomationsContext value={github}>
      <Dialog
        open
        onClose={close}
        titleId={titleId}
        size="3xl"
        className="flex flex-col overflow-hidden sm:h-[min(52rem,calc(100dvh-2rem))] sm:w-[min(67.5rem,calc(100vw-2rem))] sm:max-w-none max-h-[calc(100dvh-2rem)] max-sm:h-dvh max-sm:max-h-dvh"
      >
        {target.view === 'github' ? (
          <>
            <h2 id={titleId} className="sr-only">
              Automations
            </h2>
            <GithubView
              scope={scope}
              result={target.result}
              now={now}
              phone={phone}
              onBack={() => onTarget({ view: 'rules' })}
              trailing={<DialogCloseButton onClick={close} />}
            />
          </>
        ) : editing && api.data && !ruleAbsent && !phone ? (
          <>
            {/* The builder's breadcrumb stands where the header was; the dialog keeps its name for screen readers. */}
            <h2 id={titleId} className="sr-only">
              Automations
            </h2>
            {builder}
          </>
        ) : (
          listScreen
        )}
        {/* On a phone the builder is a drawer over the rules, which stay behind it ("The rule builder on a phone"). */}
        {editing && api.data && !ruleAbsent && phone ? (
          <RuleDrawer
            title={editing.ruleId ? 'Edit Rule' : 'New Rule'}
            onClose={backToRules}
            beforeClose={drawerMayClose}
          >
            {builder}
          </RuleDrawer>
        ) : null}
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
        {describing ? (
          <DescribeRuleDialog
            draft={(prompt) => draftRule(scope, prompt, zone)}
            onDrafted={openDraft}
            onClose={() => setDescribing(false)}
          />
        ) : null}
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
    </GithubAutomationsContext>
  );
}
