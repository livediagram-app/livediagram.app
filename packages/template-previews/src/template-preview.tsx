import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { templatePreviewGroup1 } from './template-preview-1';
import { templatePreviewGroup2 } from './template-preview-2';
import { templatePreviewGroup3 } from './template-preview-3';
import { templatePreviewGroup4 } from './template-preview-4';
import { templatePreviewGroup5 } from './template-preview-5';
import { templatePreviewGroup6 } from './template-preview-6';
import { templatePreviewGroup7 } from './template-preview-7';
import { templatePreviewGroup8 } from './template-preview-8';
import { templatePreviewGroup9 } from './template-preview-9';
import { templatePreviewGroup10 } from './template-preview-10';
import { templatePreviewGroup11 } from './template-preview-11';
import { templatePreviewGroup12 } from './template-preview-12';
import { templatePreviewGroup13 } from './template-preview-13';
import { templatePreviewGroup14 } from './template-preview-14';
import { templatePreviewGroup15 } from './template-preview-15';
import { templatePreviewGroup16 } from './template-preview-16';

// Static SVG preview tiles, one branch per TemplateKind, rendered by the
// editor's template picker and the marketing site's template gallery
// (docs/specs/019-marketing/marketing-site.md). Pure-render presentational markup, no hooks. Each branch is
// independent of the rest: adding a new template kind means appending one
// switch case in a group file plus adding the kind to TEMPLATES in
// @livediagram/templates; template-preview.test.ts fails until both exist.

// The per-kind SVGs are split across template-preview-{1..16}.tsx (each a
// switch returning null for kinds it doesn't own) to keep every file under the
// ~1000-line budget; we try each group in turn.
export function TemplatePreview({ kind }: { kind: TemplateKind }): ReactElement | null {
  return (
    templatePreviewGroup1(kind) ??
    templatePreviewGroup2(kind) ??
    templatePreviewGroup3(kind) ??
    templatePreviewGroup4(kind) ??
    templatePreviewGroup5(kind) ??
    templatePreviewGroup6(kind) ??
    templatePreviewGroup7(kind) ??
    templatePreviewGroup8(kind) ??
    templatePreviewGroup9(kind) ??
    templatePreviewGroup10(kind) ??
    templatePreviewGroup11(kind) ??
    templatePreviewGroup12(kind) ??
    templatePreviewGroup13(kind) ??
    templatePreviewGroup14(kind) ??
    templatePreviewGroup15(kind) ??
    templatePreviewGroup16(kind)
  );
}
