'use client';

// A template's picture (Start Planning's Inspiration, the Explorer's welcome): its preview, light-canvas art on a re-lit
// tile, so a template looks the same wherever it is shown.
import { TemplatePreview } from '@liveplanner/template-previews';
import { type TemplateKind } from '@liveplanner/templates';

export function TemplatePicture({ kind }: { kind: TemplateKind }) {
  return (
    <span className="preview-art-tile flex h-full w-full items-center justify-center rounded-lg bg-slate-50 [&>svg]:h-full [&>svg]:w-auto">
      <TemplatePreview kind={kind} />
    </span>
  );
}
