'use client';

import { useCallback, useEffect } from 'react';
import {
  defaultEntries,
  kindWords,
  moveOnTemplatePick,
  readTemplatePick,
  handTemplatePick,
  takeTemplatePick,
} from '@liveworkspace/explorer';
import { templateFamilyOf, type TemplateKind } from '@liveplanner/templates';
import { useToast } from '@/hooks/ui/useToast';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { PLAN_TEMPLATE_FAMILIES } from '@/lib/plan-template-families';

// A template picked from Start Planning on a plan /new just made goes to the template's default folder
// (docs/specs/013-workspace/default-folders.md "A template picked after creation"). Once per plan: the note /new
// left is taken at the first pick, and dropped if the tab gains content any other way first. Cheap until it
// matters: only a pick on a noted plan, of a template with a family, asks the index anything.
const ENTRIES = defaultEntries('liveplanner', kindWords('liveplanner'), PLAN_TEMPLATE_FAMILIES);
const nounOf = (key: string) => ENTRIES.find((e) => e.key === key)?.noun ?? 'plans';

export function useTemplatePickMove(at: {
  projectId: string | null;
  tabId: string;
  // The active tab has content: drawn by hand, the template's default no longer applies.
  tabHasContent: boolean;
}): (kind: TemplateKind) => void {
  const toast = useToast();
  const { projectId, tabId, tabHasContent } = at;
  useEffect(() => {
    if (tabHasContent && projectId && readTemplatePick()?.itemId === projectId)
      handTemplatePick(null);
  }, [tabHasContent, projectId]);
  return useCallback(
    (kind: TemplateKind) => {
      if (!projectId) return;
      // Taken now, before the template's elements land and the effect above would drop it.
      const handoff = takeTemplatePick(projectId, tabId);
      const family = templateFamilyOf(kind);
      if (!handoff || handoff.placementChosen || !family) return;
      void moveOnTemplatePick(indexClient, {
        app: 'liveplanner',
        itemId: projectId,
        handoff,
        // Mode and family: the index's intent is `<mode>:<kind>:<family>`, the kind left to the create.
        intent: `plan::${family}`,
        noun: nounOf,
      }).then((message) => {
        if (message) toast.info(message);
      });
    },
    [projectId, tabId, toast],
  );
}
