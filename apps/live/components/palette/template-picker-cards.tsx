// Card primitives for the template picker's two-level browse: a
// selectable TemplateCard (preview + title + description) and a
// CategoryCard (a collage of the category's previews that drills into
// it). Lifted out of TemplatePicker so the same card renders across the
// overview, the category detail view, and the flat search results
// without the JSX being copy-pasted three times.

import type { TemplateDescriptor, TemplateKind } from '@livediagram/templates';
import { PickerCard } from '@/components/palette/PickerCard';
import { TemplatePreview } from '@/components/palette/template-preview';

// A single selectable template tile. Click selects; double-click is the
// commit shortcut (select + Create in one gesture).
export function TemplateCard({
  template,
  active,
  onSelect,
  onCommit,
}: {
  template: TemplateDescriptor;
  active: boolean;
  onSelect: () => void;
  onCommit: () => void;
}) {
  return (
    <PickerCard
      active={active}
      onSelect={onSelect}
      onCommit={onCommit}
      label={template.title}
      description={template.description}
    >
      {/* Preview tiles are illustrative mini-canvases (light SVG), so the
          tile keeps a light backdrop in dark mode to stay legible. */}
      <div className="flex h-14 w-full items-center justify-center rounded-md bg-slate-50 dark:bg-slate-200">
        <TemplatePreview kind={template.kind} />
      </div>
    </PickerCard>
  );
}

export function CategoryCard({
  label,
  description,
  count,
  previews,
  selected,
  onOpen,
}: {
  label: string;
  description: string;
  count: number;
  previews: TemplateKind[];
  // True when the currently-selected template lives in this category, so
  // the card reads as "your selection is in here" on the overview.
  selected: boolean;
  onOpen: () => void;
}) {
  return (
    <PickerCard
      active={selected}
      onSelect={onOpen}
      ariaLabel={`Browse ${label} templates`}
      label={label}
      description={description}
      count={count}
    >
      <div className="grid h-14 w-full grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-md bg-slate-50 p-1 dark:bg-slate-200">
        {previews.slice(0, 4).map((kind) => (
          <div
            key={kind}
            className="flex items-center justify-center overflow-hidden [&_svg]:max-h-full [&_svg]:max-w-full"
          >
            <TemplatePreview kind={kind} />
          </div>
        ))}
      </div>
    </PickerCard>
  );
}
