import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { templatePreviewGroup1 } from '@/components/palette/template-preview-1';
import { templatePreviewGroup2 } from '@/components/palette/template-preview-2';
import { templatePreviewGroup3 } from '@/components/palette/template-preview-3';
import { templatePreviewGroup4 } from '@/components/palette/template-preview-4';

// Static SVG preview tiles for the TemplatePicker (one branch per
// TemplateKind). Lifted out of TemplatePicker.tsx (was 1214 lines, now
// ~360) so the picker file reads as picker logic and these stay as
// pure-render presentational markup. Each branch is independent of the
// rest: adding a new template kind means appending one switch case
// here plus adding the kind to TEMPLATES in lib/templates.

// The per-kind SVGs are split across template-preview-{1,2,3,4}.tsx (each a
// switch returning null for kinds it doesn't own) to keep every file under the
// ~1000-line budget; we try each group in turn.
export function TemplatePreview({ kind }: { kind: TemplateKind }): ReactElement | null {
  return (
    templatePreviewGroup1(kind) ??
    templatePreviewGroup2(kind) ??
    templatePreviewGroup3(kind) ??
    templatePreviewGroup4(kind)
  );
}
