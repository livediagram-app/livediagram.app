import { describeTemplatePreviews } from '@liveworkspace/template-previews/testing';
import { TEMPLATES } from '@livehuddle/templates';
import { TemplatePreview } from './template-preview';

// The template previews' checks (@liveworkspace/template-previews' testing), over this product's catalogue:
// every listed template has a preview, none clips at its tile's edge, and every hover story stays hidden at
// rest and uses only classes the motion stylesheet defines.
describeTemplatePreviews({ templates: TEMPLATES, TemplatePreview, expectArrivals: true });
