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
import type { TemplateKind } from '@livedesign/templates';
import { creationIntentOf } from '@livedesign/api-schema';
import { useToast } from '@/hooks/ui/useToast';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { intentWord } from '@/lib/api/designs';

// A template picked from Start Planning on a design /new just made goes to the template's default folder
// (docs/specs/013-workspace/default-folders.md "A template picked after creation"). Once per design: the note /new
// left is taken at the first pick, and dropped if the tab gains content any other way first. Cheap until it
// matters: only a pick on a noted design asks the index anything. Designs have one default entry, Designs.
const ENTRIES = defaultEntries('livedesign', kindWords('livedesign'), []);
const nounOf = (key: string) => ENTRIES.find((e) => e.key === key)?.noun ?? 'designs';

export function useTemplatePickMove(at: {
  designId: string | null;
  tabId: string;
  // The active tab has content: drawn by hand, the template's default no longer applies.
  tabHasContent: boolean;
}): (kind: TemplateKind) => void {
  const toast = useToast();
  const { designId, tabId, tabHasContent } = at;
  useEffect(() => {
    if (tabHasContent && designId && readTemplatePick()?.itemId === designId)
      handTemplatePick(null);
  }, [tabHasContent, designId]);
  return useCallback(
    (_kind: TemplateKind) => {
      if (!designId) return;
      // Taken now, before the template's elements land and the effect above would drop it.
      const handoff = takeTemplatePick(designId, tabId);
      if (!handoff || handoff.placementChosen) return;
      void moveOnTemplatePick(indexClient, {
        app: 'livedesign',
        itemId: designId,
        handoff,
        intent: intentWord(creationIntentOf(undefined)),
        noun: nounOf,
      }).then((message) => {
        if (message) toast.info(message);
      });
    },
    [designId, tabId, toast],
  );
}
