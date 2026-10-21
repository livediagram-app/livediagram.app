'use client';

// A template as a start's card (StartCard): its preview, light-canvas art on a re-lit tile, over its title and
// description in full. One build for every start, its own groups, its search and another mode's matches
// (StartOtherModes), so a template looks the same wherever it is found.
import { TemplatePreview } from '@liveplanner/template-previews';
import type { TemplateKind } from '@liveplanner/templates';
import { templateOf } from './start-template-items';
import type { StartPanelCard } from './StartCard';

export function TemplatePicture({ kind }: { kind: TemplateKind }) {
  return (
    <span className="preview-art-tile flex h-full w-full items-center justify-center rounded-lg bg-slate-50 [&>svg]:h-full [&>svg]:w-auto">
      <TemplatePreview kind={kind} />
    </span>
  );
}

export function templateCard(kind: TemplateKind): StartPanelCard {
  const t = templateOf(kind);
  return {
    id: t.kind,
    name: t.title,
    line: t.description,
    picture: <TemplatePicture kind={kind} />,
  };
}
