import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { templatePreviewGroup1 } from './template-preview-1';
import { templatePreviewGroup2 } from './template-preview-2';
import { templatePreviewGroup3 } from './template-preview-3';
import { templatePreviewGroup4 } from './template-preview-4';

// Static SVG preview tiles, one branch per TemplateKind, rendered by the
// editor's template picker and the marketing site's template gallery
// (spec/16). Pure-render presentational markup, no hooks. Each branch is
// independent of the rest: adding a new template kind means appending one
// switch case in a group file plus adding the kind to TEMPLATES in
// @livediagram/templates; template-preview.test.ts fails until both exist.

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
