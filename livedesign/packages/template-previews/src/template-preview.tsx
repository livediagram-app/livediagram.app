import type { ReactElement } from 'react';
import type { TemplateKind } from '@livedesign/templates';
import { templatePreviewGroup3 } from './template-preview-3';
import { templatePreviewGroup12 } from './template-preview-12';
import { templatePreviewGroup20 } from './template-preview-20';
import { templatePreviewGroup26 } from './template-preview-26';

// Static SVG preview tiles, one branch per TemplateKind, rendered by the
// editor's template picker and the marketing site's template gallery
// (docs/specs/019-marketing/marketing-site.md). Pure-render presentational markup, no hooks. Each branch is
// independent of the rest: adding a new template kind means appending one
// switch case in a group file plus adding the kind to TEMPLATES in
// @livedesign/templates; template-preview.test.ts fails until both exist.

// The per-kind SVGs are split across the template-preview-<n>.tsx groups (each a
// switch returning null for kinds it doesn't own) to keep every file under the
// ~1000-line budget; we try each group in turn.
export function TemplatePreview({ kind }: { kind: TemplateKind }): ReactElement | null {
  return (
    templatePreviewGroup3(kind) ??
    templatePreviewGroup12(kind) ??
    templatePreviewGroup20(kind) ??
    templatePreviewGroup26(kind)
  );
}
