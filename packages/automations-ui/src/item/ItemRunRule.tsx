'use client';

// Run Rule from the Rules list (blueprint item-ui.md "Test Rule and Run Rule"; automations.md "Test Rule and Run
// Rule"): a Run by Hand rule run for real. It asks which tab only when the rule reads the run's tab; otherwise it
// runs as it mounts. What happened is a toast: "Ran “<rule>”", the run's own reason when it failed or was skipped,
// or the refusal in words (the day's runs spent).

import { inTabWords, type ItemWord } from '@liveworkspace/automations/item';
import { useEffect, useRef } from 'react';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { useToast } from '@liveworkspace/workbench/hooks/ui/useToast';
import { AutomationRefusal } from '../automations-client';
import type { RunRuleProps } from '../kit';
import { useAutomationsKit } from '../kit-context';
import { nextRunWords } from '../run-words';
import type { ListedRule } from '../types';
import { ruleWantsTab } from './rule-reads';
import { TabAskDialog } from './TabAskDialog';
import type { ItemUiOutline } from './types';
import { runRefusalWords, runToast } from './words';

type Props = RunRuleProps<ListedRule, ItemUiOutline>;

/** Whether a rule shows Run Rule: it is on, not paused, and by hand. */
export const runOffered = (rule: Pick<ListedRule, 'enabled' | 'paused' | 'trigger'>): boolean =>
  rule.enabled && !rule.paused && rule.trigger.kind === 'manual';

export function ItemRunRule({ rule, outline, run, onClose }: Props) {
  const { item } = useAutomationsKit().plumbing.words;
  const toast = useToast();
  const asks = ruleWantsTab(rule);
  const started = useRef(false);
  const go = (tab: string | null) => {
    if (started.current) return;
    started.current = true;
    onClose();
    run(tab).then(
      ({ run: ran }) => {
        const said = runToast(
          rule.name,
          ran,
          ran.waitsUntil === undefined ? undefined : nextRunWords(ran.waitsUntil, Date.now()),
        );
        toast[said.tone](said.text);
      },
      (error: unknown) => {
        debugLog('[automations] run.failed', { error: String(error) });
        toast.error(
          error instanceof AutomationRefusal
            ? runRefusalWords(error.code, error.message, item)
            : `“${rule.name}” didn’t run. Check your connection and try again.`,
        );
      },
    );
  };
  // Nothing to pick: it runs as Run Rule is pressed.
  useEffect(() => {
    if (!asks) go(null);
  });
  if (!asks) return null;
  return (
    <TabAskDialog
      title="Run Rule"
      line={`${inTabWords('Pick the tab', item as ItemWord)} “${rule.name}” runs on. It runs for real.`}
      action="Run Rule"
      tabs={outline.item.tabs}
      current={outline.item.currentTabId}
      onPick={go}
      onClose={onClose}
    />
  );
}
