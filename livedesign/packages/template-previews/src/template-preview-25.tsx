import type { ReactElement } from 'react';
import type { TemplateKind } from '@livedesign/templates';

// Group 25: no template kinds since the Pages-only cut (it drew Working Backwards, which livedesign no longer has). It stays
// in TemplatePreview's chain, answering null, until the group is removed with its link in template-preview.tsx.
export function templatePreviewGroup25(_kind: TemplateKind): ReactElement | null {
  return null;
}
