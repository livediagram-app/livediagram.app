'use client';

// A template's example content (docs/specs/006-design/template-examples.md): while the active tab still holds
// example values a template landed with, an Editor's palette tray offers Clear Example Content and Keep It
// (TemplateExampleTray, @liveworkspace/workbench). A Participant and a Viewer never see it, nor zen, an embed or a
// locked tab.
// The tray alone offers it: no Tools row (owner, 2026-11-17).
import { hasUntouchedExamples } from '@livedesign/design';
import { TemplateExampleTray } from '@liveworkspace/workbench/components/chrome/PaletteTray';
import { useEditorContext } from '@/app/design/[id]/EditorContext';

export function ExampleContentTray() {
  const ctx = useEditorContext();
  const { hydrated, zenMode, embedMode, activeTab, isReadOnly, can } = ctx;
  // An Editor's alone: never gated on isReadOnly by itself, which a Participant shares with a Viewer.
  const shown =
    can.level === 'edit' &&
    hydrated &&
    !zenMode &&
    !embedMode &&
    !isReadOnly &&
    !activeTab.locked &&
    hasUntouchedExamples(activeTab.elements);
  if (!shown) return null;
  return (
    <TemplateExampleTray
      key={activeTab.id}
      onClear={ctx.clearExampleContent}
      onKeep={ctx.keepExampleContent}
    />
  );
}
