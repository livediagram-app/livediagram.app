import type { ReactElement } from 'react';
import type { TemplateKind } from '@livehuddle/templates';
import { templatePreviewGroup17 } from './template-preview-17';
import { templatePreviewGroup23 } from './template-preview-23';

// Static SVG preview tiles, one branch per TemplateKind, rendered by the
// editor's template picker and the marketing site's template gallery
// (docs/specs/019-marketing/marketing-site.md). Pure-render presentational markup, no hooks. Each branch is
// independent of the rest: adding a new template kind means appending one
// switch case in a group file plus adding the kind to TEMPLATES in
// @livehuddle/templates; template-preview.test.ts fails until both exist.

// The per-kind SVGs are split across group files (each a switch returning null for kinds it doesn't own) to keep every
// file under the ~1000-line budget; we try each group in turn. Group 17 draws Blank Space, group 23 the four Spaces;
// the other groups left with their templates (docs/specs/007-editor/templates-by-mode.md "The catalogue").
export function TemplatePreview({ kind }: { kind: TemplateKind }): ReactElement | null {
  return templatePreviewGroup17(kind) ?? templatePreviewGroup23(kind);
}
