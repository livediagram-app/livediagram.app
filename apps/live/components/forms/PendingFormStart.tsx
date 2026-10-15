'use client';

// Starts a form template's form (docs/specs/030-forms/forms.md "Starting a form"): /new made the document with an empty
// Plan tab and left the starter waiting (lib/pending-form-start.ts); once that tab is open, loaded and editable here,
// the form is started on it as Start Planning's Forms start one. Renders nothing.
import { useEffect } from 'react';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { hasPendingFormStart, takePendingFormStart } from '@/lib/pending-form-start';

export function PendingFormStart() {
  const ctx = useEditorContext();
  const tabId = ctx.activeTab.id;
  const ready = ctx.hydrated && !ctx.isReadOnly && ctx.activeTab.locked !== true;
  useEffect(() => {
    if (!ready || !hasPendingFormStart(tabId)) return;
    const starter = takePendingFormStart(tabId);
    if (starter) ctx.forms.startForm(starter);
  }, [ready, tabId, ctx.forms]);
  return null;
}
