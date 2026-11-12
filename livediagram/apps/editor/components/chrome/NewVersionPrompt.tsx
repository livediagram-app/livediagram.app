'use client';

// "A new version of livediagram is ready." (docs/specs/016-platform/new-version-prompt.md): the shared
// prompt (@liveworkspace/workbench/components/chrome/NewVersionPrompt), bound to this editor's document
// format number, its server release store and its build id.
import { DOCUMENT_FORMAT } from '@livediagram/api-schema';
import { NewVersionPrompt as SharedNewVersionPrompt } from '@liveworkspace/workbench/components/chrome/NewVersionPrompt';
import {
  EDITOR_BUILD_ID,
  serverDocumentFormat,
  subscribeServerRelease,
} from '@/lib/server-release';

export function NewVersionPrompt(props: { hasUnsavedChanges: () => boolean; reload?: () => void }) {
  return (
    <SharedNewVersionPrompt
      product="livediagram"
      editorFormat={DOCUMENT_FORMAT}
      serverFormat={serverDocumentFormat}
      subscribe={subscribeServerRelease}
      buildMetaName="livediagram-build"
      editorBuildId={EDITOR_BUILD_ID}
      {...props}
    />
  );
}
