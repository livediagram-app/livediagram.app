import type { ReactElement } from 'react';
import type { TemplateKind } from '@livedesign/templates';

// Group 2: no template kinds since the Pages-only cut (it drew the Slide Deck, which livedesign no longer has). It stays
// in TemplatePreview's chain, answering null, until the group is removed with its link in template-preview.tsx.
export function templatePreviewGroup2(_kind: TemplateKind): ReactElement | null {
  return null;
}
