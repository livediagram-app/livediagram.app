'use client';

// A template's example content (docs/specs/006-document/template-examples.md): while the active tab still holds
// example values a template landed with, an Editor's palette tray offers Clear Example Content and Keep It
// (TemplateExampleTray, @liveworkspace/workbench). A Participant and a Viewer never see it, nor zen, an embed, a
// locked tab or Watch It Built's demo.
// Its Clear Example Content is in the footer's Tools too, while the tray shows (useExampleContentToolsItem).
import { hasUntouchedExamples } from '@livediagram/document';
import { TemplateExampleTray } from '@liveworkspace/workbench/components/chrome/PaletteTray';
import { useExampleContentToolsItem } from '@liveworkspace/workbench/components/chrome/useExampleContentToolsItem';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useReplayState } from '@/lib/replay/replay-store';

export function ExampleContentTray() {
  const ctx = useEditorContext();
  const { hydrated, zenMode, embedMode, activeTab, isReadOnly, can } = ctx;
  const replaying = useReplayState().active;
  // An Editor's alone: never gated on isReadOnly by itself, which a Participant shares with a Viewer.
  const shown =
    can.level === 'edit' &&
    hydrated &&
    !zenMode &&
    !embedMode &&
    !isReadOnly &&
    !replaying &&
    !activeTab.locked &&
    hasUntouchedExamples(activeTab.elements);
  const confirm = useExampleContentToolsItem({ shown, onClear: ctx.clearExampleContent });
  if (!shown) return null;
  return (
    <>
      <TemplateExampleTray
        key={activeTab.id}
        onClear={ctx.clearExampleContent}
        onKeep={ctx.keepExampleContent}
      />
      {confirm}
    </>
  );
}
