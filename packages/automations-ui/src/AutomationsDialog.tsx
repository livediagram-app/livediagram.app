'use client';

// The Automations screen (liveplanner/docs/specs/026-plan/automations.md "The Automations screen"; blueprint ui.md
// "The screen"): the header (Automations, what rules do, New Rule), the Rules · n, Audit Trail, Templates and
// Connections tabs with the Runs today meter, then the tab, or a rule's builder in its place. Full screen on a
// phone, its meter at the foot. Leaving a builder with unsaved changes asks Discard Changes? first, whether by the
// breadcrumb, a tab or the close. A template picked opens the builder filled from the item, unsaved and off, named
// uniquely. Add a Connection… (a message step's panel) opens the Connections tab with the rule kept as it stands,
// and Back to Rule opens the builder on it again. An app's own views (kit.views) open from a button beside New Rule,
// in the tab's place, or as a tab of their own. Everything an app's own is read from its kit (kit.ts).

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { AUTOMATION_RULES_MAX, freeRuleName } from '@liveworkspace/automations';
import {
  Button,
  CompactEmptyState,
  DialogCloseButton,
  ToolFooter,
  useDialogInline,
  useMediaQuery,
} from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { ConfirmDialog } from '@liveworkspace/workbench/components/dialogs/ConfirmDialog';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { useToast } from '@liveworkspace/workbench/hooks/ui/useToast';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { AutomationRefusal } from './automations-client';
import type { AutomationsTarget } from './AutomationsContext';
import { automationsHeroArt } from './AutomationsHeroArt';
import { ConnectionsTab } from './ConnectionsTab';
import { DescribeRuleDialog } from './DescribeRuleDialog';
import { DraftedNote } from './DraftedNote';
import { BoltIcon } from './glyphs';
import type { AnyAutomationsKit, AutomationsScope, AutomationsView } from './kit';
import {
  AutomationsScreenContext,
  useAutomationsKit,
  type AutomationsScreen,
  type KeptRule,
} from './kit-context';
import { NewRuleMenu } from './NewRuleMenu';
import { RefreshButton, REFRESH_FAILED } from './RefreshButton';
import { newRuleBody, nextRuleName } from './rule-draft';
import { RuleBuilder } from './RuleBuilder';
import { RuleDrawer } from './RuleDrawer';
import { RulesEmpty } from './RulesEmpty';
import { RulesList } from './RulesList';
import { RunLog, type RunLogReload } from './RunLog';
import { RunsMeter } from './RunsMeter';
import { localZone, useMinuteClock } from './screen-clock';
import { ScreenTabs, screenPanelId, screenTabId, type ScreenTab } from './ScreenTabs';
import { TemplatesGallery } from './TemplatesGallery';
import type { ListedRule, RuleBody, RuleStart } from './types';
import { readAutomations, useAutomations } from './use-automations';
import { useCarriedRule } from './use-carried-rule';

/** A template's rule over this item, named so no rule here has its name, and what it left to pick. */
export function templateStart(
  kit: AnyAutomationsKit,
  id: string,
  outline: unknown,
  rules: readonly { id: string; name: string }[],
  timeZone: string,
): RuleStart | null {
  const start = kit.templates.build(id, outline, timeZone);
  if (!start) return null;
  return {
    body: { ...start.body, name: freeRuleName(start.body.name, rules) },
    picks: start.picks,
  };
}

// Inside Tools or not, read where it counts: the Dialog sets it for what it draws.
function WhenInline({ children, not = false }: { children: ReactNode; not?: boolean }) {
  return useDialogInline() !== not ? children : null;
}

// The app's views that are offered here. The kit's list is fixed, so each view's hook is called in the same order
// on every render.
function useViewsOn(views: readonly AutomationsView[]): readonly AutomationsView[] {
  return views.filter((view) => view.useOn());
}

const NO_VIEWS: readonly AutomationsView[] = [];

export function AutomationsDialog({
  scope,
  target,
  onTarget,
  onClose,
  signedIn = false,
}: {
  scope: AutomationsScope;
  target: AutomationsTarget;
  onTarget: (next: AutomationsTarget) => void;
  onClose: () => void;
  // Connections are an account's: a guest is told to sign in to pick one.
  signedIn?: boolean;
}) {
  const kit = useAutomationsKit();
  const { client, track, words } = kit.plumbing;
  const api = useAutomations(client, scope);
  // Each opening reads the list again, so Last Run, This Week and Runs today are fresh (the list read for the footer's
  // dot, or by an earlier opening, keeps showing meanwhile). A read already under way is not repeated. `fresh` once this
  // opening's read settles: until then a rule the list lacks may be one made since, never yet called deleted. Kept as
  // the scope it settled for, so a scope changed while open waits for its own read.
  const [freshFor, setFreshFor] = useState<AutomationsScope | null>(null);
  const fresh = freshFor === scope;
  useEffect(() => {
    let live = true;
    void readAutomations(client, scope).then(() => {
      if (live) setFreshFor(scope);
    });
    return () => {
      live = false;
    };
  }, [client, scope]);
  // Refresh (beside the meter): the list and the open Audit Trail read again, one press at a time. It only reads, so
  // a rule open in the builder keeps its unsaved changes (the builder reads its rule once, as it mounts).
  const runsReload = useRef<RunLogReload | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const outline: unknown = kit.useOutline();
  const openSubject = kit.audit.open?.useGo();
  const views = useViewsOn(kit.views ?? NO_VIEWS);
  const toast = useToast();
  const now = useMinuteClock();
  const phone = !useMediaQuery('(min-width: 640px)');
  const titleId = useId();
  const tabsId = useId();
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [leaving, setLeaving] = useState<(() => void) | null>(null);
  // The rule Run Rule was pressed on, while the app's own run (kit.runRule) is up.
  const [running, setRunning] = useState<ListedRule | null>(null);
  const runRule = kit.runRule;
  const rules = useMemo<readonly ListedRule[]>(() => api.data?.rules ?? [], [api.data]);
  // The rule the builder holds (its own word of it, as it changes), and the one held while the person is on the
  // Connections tab for Add a Connection…: Back to Rule opens the builder on it again.
  const builderDraft = useRef<KeptRule | null>(null);
  const [held, setHeld] = useState<KeptRule | null>(null);
  // Describe a Rule: its dialog, and the rule it drafted (numbered, so each draft mounts the builder afresh).
  const [describing, setDescribing] = useState(false);
  const [drafted, setDrafted] = useState<(RuleStart & { n: number }) | null>(null);

  const view = target.view === 'view' ? (views.find((v) => v.id === target.id) ?? null) : null;
  // The open tab: a rule's builder and a view opened from its button sit under Rules.
  const screenTab: ScreenTab =
    target.view === 'rule'
      ? 'rules'
      : target.view === 'view'
        ? view?.tab
          ? `view:${view.id}`
          : 'rules'
        : target.view;

  // Every way out of a rule with unsaved changes asks first: out of its builder, and away from the Connections tab
  // while it is held there.
  const atRisk = (target.view === 'rule' || held !== null) && dirty;
  const guard = useCallback(
    (go: () => void) => () => {
      if (atRisk) setLeaving(() => go);
      else {
        setHeld(null);
        go();
      }
    },
    [atRisk],
  );
  const close = guard(onClose);
  // The list's own ways on (a tab, New Rule, a template): they ask only for a rule held on the Connections tab.
  const heldAtRisk = held !== null && dirty;
  const fromList = (go: () => void) => () => {
    if (heldAtRisk) setLeaving(() => go);
    else {
      setHeld(null);
      go();
    }
  };
  // The phone's rule drawer asks before any way out while the rule has unsaved changes, and stays open meanwhile.
  const backToRules = useCallback(() => onTarget({ view: 'rules' }), [onTarget]);
  const drawerMayClose = () => {
    if (!dirty) return true;
    setLeaving(() => backToRules);
    return false;
  };
  // What the app's own parts reach the screen through, steady while it is open: it reads the guard as it stands.
  const guardNow = useRef(guard);
  useEffect(() => {
    guardNow.current = guard;
  }, [guard]);
  const screen = useMemo<AutomationsScreen>(
    () => ({
      scope,
      signedIn,
      openView: (id, arrival) =>
        guardNow.current(() => onTarget({ view: 'view', id, ...(arrival ? { arrival } : {}) }))(),
      openConnections: () => {
        setHeld(builderDraft.current);
        onTarget({ view: 'connections' });
      },
      openRuns: (ruleId) => guardNow.current(() => onTarget({ view: 'runs', ruleId }))(),
      draft: () => builderDraft.current,
      keepDraft: (kept) => {
        builderDraft.current = kept;
      },
    }),
    [scope, signedIn, onTarget],
  );

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

  const actionsFor = (rule: ListedRule) => ({
    onOpen: () => onTarget({ view: 'rule', ruleId: rule.id }),
    ...(runRule?.offered(rule) ? { onRun: () => setRunning(rule) } : {}),
    onToggle: (enabled: boolean) =>
      void withBusy(rule.id, async () => {
        await api.toggle(rule.id, enabled);
        track(enabled ? 'rule_on' : 'rule_off');
      }).catch(failed('toggle')),
    onDuplicate: () =>
      void api
        .duplicate(rule.id)
        .then((copy) => toast.success(`Made ${copy.name}`), failed('duplicate')),
    onRunLog: () => onTarget({ view: 'runs', ruleId: rule.id }),
    onFixConnection: () => onTarget({ view: 'connections' }),
    onTakeOver: () =>
      void withBusy(rule.id, async () => {
        const { name, trigger, conditions, steps, chain, timeZone } = rule;
        await api.save(rule.id, { name, trigger, conditions, steps, chain, timeZone });
        await api.toggle(rule.id, true);
        track('rule_taken_over');
        toast.success(`${rule.name} now runs as you`);
      }).catch(failed('take over')),
    onDelete: () =>
      void api.remove(rule.id).then(() => {
        track('rule_deleted');
        toast.info(`Deleted ${rule.name}`);
      }, failed('delete')),
  });

  const openRunSubject = openSubject
    ? (id: string) => {
        onClose();
        openSubject(id);
      }
    : undefined;

  const newRule = fromList(() => onTarget({ view: 'rule', ruleId: null }));
  const openTemplates = fromList(() => onTarget({ view: 'templates' }));
  const pickTemplate = (id: string) => {
    track('template_opened', id);
    fromList(() => onTarget({ view: 'rule', ruleId: null, template: id }))();
  };
  const full = rules.length >= AUTOMATION_RULES_MAX;
  const zone = localZone();
  const describe = fromList(() => {
    track('describe_opened');
    setDescribing(true);
  });
  const openDraft = (d: { rule: RuleBody; picks: RuleStart['picks'] }) => {
    track('draft_created');
    setDescribing(false);
    setDrafted((was) => ({ body: d.rule, picks: d.picks, n: (was?.n ?? 0) + 1 }));
    onTarget({ view: 'rule', ruleId: null, draft: true });
  };
  const editing = target.view === 'rule' ? target : null;
  // The rule as it was left: kept for Back to Rule, or carried across the phone breakpoint.
  const resumeKept = useCarriedRule(phone, target, builderDraft);
  const fromDraft = editing && !editing.ruleId && editing.draft ? drafted : null;
  const editingRule = editing?.ruleId ? (rules.find((r) => r.id === editing.ruleId) ?? null) : null;
  // A rule opened by its id (a link to it) that the list lacks opens no builder, never a blank new rule.
  const ruleAbsent = !!editing?.ruleId && !editingRule;
  // Before this opening's read lands (or while it is read again): wait for it (a rule made since the list was read).
  const ruleWaiting = ruleAbsent && (!fresh || api.status === 'loading');
  // Said deleted only once a read has answered without it; a failed read says it failed.
  const ruleGone = ruleAbsent && !ruleWaiting && !!api.data && api.status === 'ready';
  // Built once per template opened (and as the item's content or rules change), so its picks are one list.
  const startTemplate = editing && !editing.ruleId ? editing.template : undefined;
  const fromTemplate = useMemo(
    () => (startTemplate ? templateStart(kit, startTemplate, outline, rules, zone) : null),
    [kit, startTemplate, outline, rules, zone],
  );
  // A rule kept from before, not saved yet: it opens as it was left.
  const keptNew = editing && !editing.ruleId ? editing.kept : undefined;
  // Read once, as the builder mounts (its key changes with the rule).
  const initial: RuleBody =
    editingRule ??
    keptNew?.body ??
    fromDraft?.body ??
    fromTemplate?.body ??
    newRuleBody(
      nextRuleName(rules.map((r) => r.name)),
      zone,
      kit.kinds.triggers[kit.kinds.firstTrigger]!.fresh(outline),
    );

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    void Promise.all([readAutomations(client, scope), runsReload.current?.() ?? true]).then(
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
          description={`Ask whoever shared this ${words.item} for edit access to see and change its rules.`}
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
          description={`It’s no longer in this ${words.item}. Its runs stay in the Audit Trail until they age out.`}
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
          onOpenSubject={openRunSubject}
          reloadRef={runsReload}
          onTakeOver={(r) => actionsFor(r).onTakeOver()}
        />
      );
    if (target.view === 'templates')
      return (
        <div className={`min-h-0 flex-1 overflow-y-auto ${phone ? 'px-4 py-4' : 'px-6 py-5'}`}>
          {full ? (
            <Callout tone="warning" size="md" className="mb-4">
              This {words.item} has {AUTOMATION_RULES_MAX} rules, the most it can hold. Delete one
              to add another.
            </Callout>
          ) : null}
          <p className="mb-4 text-[13px] text-slate-500 dark:text-slate-400">
            Pick one to open it in the builder, filled in from this {words.item}. Nothing is saved
            until you save the rule.
          </p>
          <TemplatesGallery onPick={pickTemplate} heading="All Templates" disabled={full} />
        </div>
      );
    if (target.view === 'connections')
      return (
        <ConnectionsTab
          scope={scope}
          signedIn={signedIn}
          phone={phone}
          kept={held}
          onBackToRule={() => {
            const kept = held;
            if (!kept) return;
            setHeld(null);
            onTarget({ view: 'rule', ruleId: kept.ruleId, kept });
          }}
        />
      );
    if (view?.tab)
      return (
        <view.View
          scope={scope}
          arrival={target.view === 'view' ? target.arrival : undefined}
          now={now}
          phone={phone}
          onBack={() => onTarget({ view: 'rules' })}
          trailing={null}
        />
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
          ? 'kept'
          : fromDraft
            ? `draft:${fromDraft.n}`
            : editing.template
              ? `template:${editing.template}`
              : 'new')
      }
      rule={editingRule}
      initial={initial}
      resume={resumeKept}
      blank={!editing.ruleId && !editing.kept && !fromDraft && !editing.template}
      picks={fromDraft?.picks ?? fromTemplate?.picks ?? resumeKept?.picks}
      notice={fromDraft ? <DraftedNote /> : undefined}
      timeZone={zone}
      scope={scope}
      signedIn={signedIn}
      outline={outline}
      api={api}
      now={now}
      phone={phone}
      onDirty={setDirty}
      onBack={guard(() => onTarget({ view: 'rules' }))}
      onSaved={(rule) => onTarget({ view: 'rule', ruleId: rule.id })}
      trailing={<DialogCloseButton onClick={close} />}
    />
  ) : null;
  const buttons = views.filter((v) => v.Button && !v.tab);
  const viewButtons = (footer: boolean) =>
    buttons.map((v) => {
      const ViewButton = v.Button!;
      return (
        <ViewButton
          key={v.id}
          phone={phone}
          {...(footer ? { footer: true } : {})}
          onOpen={() => screen.openView(v.id)}
        />
      );
    });
  const heroClassName = buttons.find((v) => v.heroClassName)?.heroClassName;
  const listScreen = (
    <>
      {/* The dialog hero header, drawn for rules ("The Automations screen"). */}
      <HeroDialogHeader
        art={automationsHeroArt}
        titleId={titleId}
        title="Automations"
        subtitle={words.subtitle}
        actions={
          <WhenInline not>
            {viewButtons(false)}
            <NewRuleMenu
              disabled={!api.data || full}
              onBlank={newRule}
              onTemplates={openTemplates}
              onDescribe={describe}
            />
          </WhenInline>
        }
        onClose={close}
        // The art's centre clears the wider actions when a view's button stands beside New Rule.
        className={heroClassName}
      />
      <ScreenTabs
        idPrefix={tabsId}
        current={screenTab}
        rules={api.data ? rules.length : null}
        phone={phone}
        meter={meter}
        extra={views.filter((v) => v.tab).map((v) => ({ tab: `view:${v.id}`, label: v.tab! }))}
        onTab={(tab) =>
          fromList(() =>
            onTarget(
              tab.startsWith('view:')
                ? { view: 'view', id: tab.slice('view:'.length) }
                : { view: tab as 'rules' | 'runs' | 'templates' | 'connections' },
            ),
          )()
        }
      />
      <div
        role="tabpanel"
        id={screenPanelId(tabsId)}
        aria-labelledby={screenTabId(tabsId, screenTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* The item spent its runs for the day ("Runs, limits and loops"): the meter is full and says why. */}
        {api.data && api.data.runsToday >= api.data.runsPerDay ? (
          <Callout
            tone="warning"
            size="md"
            role="status"
            className={`mt-3 ${phone ? 'mx-4' : 'mx-6'}`}
          >
            Daily limit reached: rules run again tomorrow
          </Callout>
        ) : null}
        {body}
      </div>
      {phone && meter ? (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">{meter}</div>
      ) : null}
      {/* Inside Tools, New Rule (and a view's button) sit in the tools' one footer, pinned at the foot. The
          Connections tab pins its own Add Connection there instead. */}
      {target.view === 'connections' ? null : (
        <WhenInline>
          <ToolFooter>
            {viewButtons(true)}
            <NewRuleMenu
              footer
              disabled={!api.data || full}
              onBlank={newRule}
              onTemplates={openTemplates}
              onDescribe={describe}
            />
          </ToolFooter>
        </WhenInline>
      )}
    </>
  );

  const Provider = kit.Provider;
  const dialog = (
    <Dialog
      open
      onClose={close}
      titleId={titleId}
      size="3xl"
      className="flex flex-col overflow-hidden sm:h-[min(52rem,calc(100dvh-2rem))] sm:w-[min(67.5rem,calc(100vw-2rem))] sm:max-w-none max-h-[calc(100dvh-2rem)] max-sm:h-dvh max-sm:max-h-dvh"
    >
      {view && !view.tab ? (
        <>
          <h2 id={titleId} className="sr-only">
            Automations
          </h2>
          <view.View
            scope={scope}
            arrival={target.view === 'view' ? target.arrival : undefined}
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
      {describing ? (
        <DescribeRuleDialog
          draft={(prompt) => client.draft(scope, prompt, zone)}
          onDrafted={openDraft}
          onClose={() => setDescribing(false)}
        />
      ) : null}
      {running && runRule ? (
        <runRule.Run
          rule={running}
          outline={outline}
          run={(subject) => {
            track('rule_run');
            return api.run(running.id, subject);
          }}
          onClose={() => setRunning(null)}
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
            setHeld(null);
            go();
          }}
        />
      ) : null}
    </Dialog>
  );
  return (
    <AutomationsScreenContext.Provider value={screen}>
      {Provider ? <Provider>{dialog}</Provider> : dialog}
    </AutomationsScreenContext.Provider>
  );
}
