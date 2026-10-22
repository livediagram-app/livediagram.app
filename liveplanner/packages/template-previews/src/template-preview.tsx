import type { ReactElement } from 'react';
import type { TemplateKind } from '@liveplanner/templates';
import { templatePreviewGroup2 } from './template-preview-2';
import { templatePreviewGroup12 } from './template-preview-12';
import { templatePreviewGroup15 } from './template-preview-15';
import { templatePreviewGroup16 } from './template-preview-16';
import { templatePreviewGroup24 } from './template-preview-24';

// Static SVG preview tiles, one branch per TemplateKind, rendered by the
// editor's template picker and the marketing site's template gallery
// (docs/specs/019-marketing/marketing-site.md). Pure-render presentational markup, no hooks. Each branch is
// independent of the rest: adding a new template kind means appending one
// switch case in a group file plus adding the kind to TEMPLATES in
// @liveplanner/templates; template-preview.test.ts fails until both exist.

// The per-kind SVGs are split across template-preview-<n>.tsx (each a
// switch returning null for kinds it doesn't own) to keep every file under the
// ~1000-line budget; we try each group in turn.
export function TemplatePreview({ kind }: { kind: TemplateKind }): ReactElement | null {
  return (
    templatePreviewGroup2(kind) ??
    templatePreviewGroup12(kind) ??
    templatePreviewGroup15(kind) ??
    templatePreviewGroup16(kind) ??
    templatePreviewGroup24(kind)
  );
}
