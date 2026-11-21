'use client';

// Makes a template's starter rules on the plan it just made (docs/specs/026-plan/plan-templates.md "Starter rules";
// lib/pending-starter-rules.ts): once Automations are this person's on this plan (a signed-in Editor of the whole plan,
// saved to an account), the kind left under the plan's first tab is taken, its rules built (their builders load only
// then) and made as Make Plan makes its own, each turned off after when it ships off. On a plan kept Offline the
// kind is kept with the plan, and the rules are made when it is saved to the cloud (offline-sync.ts); for a guest on a
// server plan, who can hold no rule, it is dropped. /new and the workspace's New need none of this: their create
// names the template (lib/api/projects.ts starterRulesAskOf). Draws nothing.

import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/ui/useToast';
import { onPendingStarterRules, takePendingStarterRules } from '@/lib/pending-starter-rules';
import {
  STARTER_RULES_FAILED,
  makeStarterRules,
} from '@/components/plan/start/describe-plan/starter-rules-client';
import { starterRulesAskOf } from '@/lib/api/starter-rules-ask';
import { offlineSaveStarterRules } from '@/lib/offline/offline-store';
import {
  useAutomationsAccess,
  useAutomationsDoor,
} from '@liveworkspace/automations-ui/AutomationsContext';
import { readAutomations } from './use-automations';

export function PendingStarterRules({
  tabId,
  projectId,
  offline,
}: {
  tabId: string | undefined;
  // Null while the editor has no project open.
  projectId: string | null;
  // A plan kept Offline.
  offline: boolean;
}) {
  const scope = useAutomationsAccess()?.scope ?? null;
  // Present with `offline` for someone who must sync the plan or sign in first.
  const barred = useAutomationsDoor()?.offline === true;
  const toast = useToast();
  // Start Planning leaves a kind while the editor is open.
  const [left, setLeft] = useState(0);
  useEffect(() => onPendingStarterRules(() => setLeft((n) => n + 1)), []);

  useEffect(() => {
    if (!tabId || (!scope && !barred)) return;
    const kind = takePendingStarterRules(tabId);
    if (!kind) return;
    const ask = starterRulesAskOf(kind)!;
    if (!scope) {
      if (offline && projectId)
        void offlineSaveStarterRules(projectId, ask).catch(() => toast.error(STARTER_RULES_FAILED));
      return;
    }
    void import('@liveplanner/templates/template-starter-rules')
      .then((m) => makeStarterRules(scope, m.templateStarterRules(kind, ask.timeZone), () => {}))
      .catch(() => toast.error(STARTER_RULES_FAILED))
      // The Rules list and the footer's count read the rules made.
      .finally(() => void readAutomations(scope));
  }, [tabId, projectId, offline, scope, barred, left, toast]);

  return null;
}
