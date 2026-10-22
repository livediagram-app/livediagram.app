import type { ReactElement } from 'react';
import type { TemplateKind } from '@livedesign/templates';

// Group 5: no template kinds since the Pages-only cut (it drew the Storyboard, the Floor Plan and the Project Brief, which livedesign no longer has). It stays
// in TemplatePreview's chain, answering null, until the group is removed with its link in template-preview.tsx.
export function templatePreviewGroup5(_kind: TemplateKind): ReactElement | null {
  return null;
}
