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
import { templateFamilyOf, type TemplateKind } from '@livediagram/templates';
import { creationIntentOf, DEFAULT_FOLDER_OPTIONS, indexIntentOf } from '@livediagram/api-schema';
import { buildTemplatedTab } from '@/lib/template-builders';
import { useToast } from '@/hooks/ui/useToast';
import { CANVAS_TEMPLATE_FAMILIES } from '@/lib/canvas-template-families';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';

// A template picked from a start screen on a canvas /new just made goes to the template's default folder, else the
// default for new canvases (docs/specs/013-workspace/default-folders.md "A template picked after creation"). Once per
// canvas: the note /new left is taken at the first pick, and dropped if the tab gains content any other way first.
// Cheap until it matters: only a pick on a noted canvas asks the index anything.
const ENTRIES = defaultEntries(
  'livediagram',
  kindWords('livediagram'),
  CANVAS_TEMPLATE_FAMILIES,
  DEFAULT_FOLDER_OPTIONS,
);
const nounOf = (key: string) => ENTRIES.find((e) => e.key === key)?.noun ?? 'canvases';

export function useTemplatePickMove(at: {
  documentId: string | null;
  tabId: string;
  // The active tab has content: drawn by hand, the template's default no longer applies.
  tabHasContent: boolean;
}): (kind: TemplateKind) => void {
  const toast = useToast();
  const { documentId, tabId, tabHasContent } = at;
  useEffect(() => {
    if (tabHasContent && documentId && readTemplatePick()?.itemId === documentId)
      handTemplatePick(null);
  }, [tabHasContent, documentId]);
  return useCallback(
    (kind: TemplateKind) => {
      if (!documentId) return;
      // Taken now, before the template's elements land and the effect above would drop it.
      const handoff = takeTemplatePick(documentId, tabId);
      if (!handoff || handoff.placementChosen) return;
      // What the template makes the canvas, as a create would record it: its tab's kind, its family, the mode it
      // opens in. Their defaults apply in that order, then the default for new canvases.
      const intent = indexIntentOf(
        creationIntentOf(
          buildTemplatedTab(kind, 'brand', 'intent', 'Tab 1'),
          templateFamilyOf(kind),
        ),
      );
      void moveOnTemplatePick(indexClient, {
        app: 'livediagram',
        itemId: documentId,
        handoff,
        intent: intent ?? '',
        noun: nounOf,
      }).then((message) => {
        if (message) toast.info(message);
      });
    },
    [documentId, tabId, toast],
  );
}
