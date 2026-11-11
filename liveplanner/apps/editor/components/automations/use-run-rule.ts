'use client';

// Run Rule's choices for one card (docs/specs/026-plan/automations.md "On cards"): an Editor's, when at least one
// Run from a Card rule is on; null otherwise (no Automations scope, nothing manual on). Running one says "Ran <rule>"
// or the failure, as a toast.

import { useMemo } from 'react';
import { track } from '@/lib/telemetry';
import { useToast } from '@/hooks/ui/useToast';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { useAutomationsAccess } from './AutomationsContext';
import { AutomationRefusal } from './automations-client';
import type { RunRuleChoices } from './RunRuleMenu';
import { useAutomations } from './use-automations';

export function useRunRule(itemId: string): RunRuleChoices | null {
  const access = useAutomationsAccess();
  const api = useAutomations(access?.scope ?? null);
  const toast = useToast();
  const rules = api.data?.rules;
  return useMemo(() => {
    if (!access || !rules) return null;
    const manual = rules.filter((r) => r.enabled && r.trigger.kind === 'manual');
    if (manual.length === 0) return null;
    return {
      rules: manual.map((r) => ({ id: r.id, name: r.name })),
      onRun: (id: string) => {
        const name = manual.find((r) => r.id === id)?.name ?? 'the rule';
        track('Plan', 'Ran', 'AutomationManual');
        api.run(id, itemId).then(
          ({ run }) => {
            if (run.result === 'failed') toast.error(run.reason ?? `${name} didn’t run.`);
            else if (run.result === 'done') toast.success(`Ran ${name}`);
            else toast.info(run.reason ?? `${name} found nothing to do on this card.`);
          },
          (error: unknown) => {
            debugLog('[automations] run.failed', { error: String(error) });
            toast.error(
              error instanceof AutomationRefusal ? error.message : `${name} didn’t run. Try again.`,
            );
          },
        );
      },
      onManage: () => access.open(),
    };
  }, [access, rules, api, itemId, toast]);
}
