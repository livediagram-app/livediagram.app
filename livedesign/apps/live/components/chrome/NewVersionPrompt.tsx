'use client';

// "A new version of livedesign is ready." (docs/specs/016-platform/new-version-prompt.md): the shared
// prompt (@liveworkspace/workbench/components/chrome/NewVersionPrompt), bound to this editor's design
// format number, its server release store and its build id.
import { DESIGN_FORMAT } from '@livedesign/api-schema';
import { NewVersionPrompt as SharedNewVersionPrompt } from '@liveworkspace/workbench/components/chrome/NewVersionPrompt';
import { EDITOR_BUILD_ID, serverDesignFormat, subscribeServerRelease } from '@/lib/server-release';

export function NewVersionPrompt(props: { hasUnsavedChanges: () => boolean; reload?: () => void }) {
  return (
    <SharedNewVersionPrompt
      product="livedesign"
      editorFormat={DESIGN_FORMAT}
      serverFormat={serverDesignFormat}
      subscribe={subscribeServerRelease}
      buildMetaName="livedesign-build"
      editorBuildId={EDITOR_BUILD_ID}
      {...props}
    />
  );
}
