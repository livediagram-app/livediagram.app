import type { TemplateKind } from '@livediagram/templates';
import {
  PreviewFan as SharedFan,
  type PreviewFanProps,
} from '@liveworkspace/template-previews/preview-fan';
import { DeferredPreviewFan as SharedDeferredFan } from '@liveworkspace/template-previews/deferred-preview-fan';
import { TemplatePreview } from './template-preview';

// A category drawn as a fanned stack of its first three templates' previews: @liveworkspace/template-previews'
// fan, over this product's previews. Shared by the landing page's folded category cards and the editor
// template picker's category tiles, so a category looks the same wherever it is offered.
export function PreviewFan(props: PreviewFanProps<TemplateKind>) {
  return <SharedFan Preview={TemplatePreview} {...props} />;
}

// The same fan with only its front card in the first paint, the other two added when the browser is idle: for a page
// with many of them (the landing page's folded categories). Client-only, so it belongs inside a `'use client'` tree.
export function DeferredPreviewFan(props: PreviewFanProps<TemplateKind>) {
  return <SharedDeferredFan Preview={TemplatePreview} {...props} />;
}
