'use client';

// "A new version of liveplanner is ready." (docs/specs/016-platform/new-version-prompt.md): the shared
// prompt (@liveworkspace/workbench/components/chrome/NewVersionPrompt), bound to this editor's project
// format number, its server release store and its build id.
import { PROJECT_FORMAT } from '@liveplanner/api-schema';
import { NewVersionPrompt as SharedNewVersionPrompt } from '@liveworkspace/workbench/components/chrome/NewVersionPrompt';
import { EDITOR_BUILD_ID, serverProjectFormat, subscribeServerRelease } from '@/lib/server-release';

export function NewVersionPrompt(props: { hasUnsavedChanges: () => boolean; reload?: () => void }) {
  return (
    <SharedNewVersionPrompt
      product="liveplanner"
      editorFormat={PROJECT_FORMAT}
      serverFormat={serverProjectFormat}
      subscribe={subscribeServerRelease}
      buildMetaName="liveplanner-build"
      editorBuildId={EDITOR_BUILD_ID}
      {...props}
    />
  );
}
