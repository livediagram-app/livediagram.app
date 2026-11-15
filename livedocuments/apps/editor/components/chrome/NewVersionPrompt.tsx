'use client';

// "A new version of livedocuments is ready." (docs/specs/016-platform/new-version-prompt.md): the shared
// prompt (@liveworkspace/workbench/components/chrome/NewVersionPrompt), bound to this editor's document
// format number, its server release store and its build id.
import { DOCUMENT_FORMAT } from '@livedocuments/api-schema';
import { NewVersionPrompt as SharedNewVersionPrompt } from '@liveworkspace/workbench/components/chrome/NewVersionPrompt';
import {
  EDITOR_BUILD_ID,
  serverDocumentFormat,
  subscribeServerRelease,
} from '@/lib/server-release';
import { useEditorChromeStore } from '@/app/document/[id]/EditorContext';

export function NewVersionPrompt(props: { hasUnsavedChanges: () => boolean; reload?: () => void }) {
  return (
    <SharedNewVersionPrompt
      product="livedocuments"
      editorFormat={DOCUMENT_FORMAT}
      serverFormat={serverDocumentFormat}
      subscribe={subscribeServerRelease}
      buildMetaName="livedocuments-build"
      editorBuildId={EDITOR_BUILD_ID}
      {...props}
    />
  );
}

/** The prompt in the editor, which asks the chrome store whether edits are unsaved when it needs to know, so the editor
 *  view places it once and its renders (a typing commit among them) never reach it
 *  (docs/specs/007-editor/blueprints/flashcards.md "Performance and limits"). */
export function EditorNewVersionPrompt() {
  const chrome = useEditorChromeStore();
  return <NewVersionPrompt hasUnsavedChanges={() => chrome.get().hasUnsavedChanges()} />;
}
