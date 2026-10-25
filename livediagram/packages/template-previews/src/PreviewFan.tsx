import type { TemplateKind } from '@livediagram/templates';
import {
  PreviewFan as SharedFan,
  type PreviewFanProps,
} from '@liveworkspace/template-previews/preview-fan';
import { TemplatePreview } from './template-preview';

// A category drawn as a fanned stack of its first three templates' previews: @liveworkspace/template-previews'
// fan, over this product's previews. Shared by the landing page's folded category cards and the editor
// template picker's category tiles, so a category looks the same wherever it is offered.
export function PreviewFan(props: PreviewFanProps<TemplateKind>) {
  return <SharedFan Preview={TemplatePreview} {...props} />;
}
