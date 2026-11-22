'use client';

// A template's example content (docs/specs/006-document/template-examples.md): while the active tab still holds
// example values a template landed with, an Editor's palette tray offers Clear Example Content and Keep It
// (TemplateExampleTray, @liveworkspace/workbench). A Participant and a Viewer never see it, nor zen, an embed or a
// locked tab. It reads one yes or no off the chrome store, so a typing commit re-renders nothing here; the answer is
// cached per elements array (hasUntouchedExamples).
// The tray alone offers it: no Tools row (owner, 2026-11-17).
import { hasUntouchedExamples } from '@liveknowledge/document';
import { TemplateExampleTray } from '@liveworkspace/workbench/components/chrome/PaletteTray';
import {
  useEditorChrome,
  useEditorChromeStore,
  type EditorContextValue,
} from '@/app/document/[id]/EditorContext';

export function exampleTrayShown(
  editor: Pick<
    EditorContextValue,
    'hydrated' | 'zenMode' | 'embedMode' | 'isReadOnly' | 'activeTab' | 'can'
  >,
): boolean {
  const { hydrated, zenMode, embedMode, isReadOnly, activeTab, can } = editor;
  // An Editor's alone: never gated on isReadOnly by itself, which a Participant shares with a Viewer.
  if (can.level !== 'edit') return false;
  if (!hydrated || zenMode || embedMode || isReadOnly || activeTab.locked) return false;
  return hasUntouchedExamples(activeTab.elements);
}

export function ExampleContentTray() {
  const chrome = useEditorChromeStore();
  const shown = useEditorChrome(exampleTrayShown);
  const tabId = useEditorChrome((s) => s.activeTab.id);
  if (!shown) return null;
  return (
    <TemplateExampleTray
      key={tabId}
      onClear={() => chrome.get().clearExampleContent()}
      onKeep={() => chrome.get().keepExampleContent()}
    />
  );
}
