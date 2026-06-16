// Card primitives for the template picker's two-level browse: a
// selectable TemplateCard (preview + title + description) and a
// CategoryCard (a collage of the category's previews that drills into
// it). Lifted out of TemplatePicker so the same card renders across the
// overview, the category detail view, and the flat search results
// without the JSX being copy-pasted three times.

import type { TemplateDescriptor, TemplateKind } from '@/lib/templates';
import { TemplatePreview } from './template-preview';

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
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onCommit}
      aria-pressed={active}
      className={
        active
          ? 'flex flex-col items-start gap-1.5 rounded-lg border-2 border-brand-400 bg-brand-50 p-2 text-left dark:border-brand-500 dark:bg-brand-500/15'
          : 'flex flex-col items-start gap-1.5 rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10'
      }
    >
      {/* Preview tiles are illustrative mini-canvases (light SVG), so the
          tile keeps a light backdrop in dark mode to stay legible. */}
      <div className="flex h-14 w-full items-center justify-center rounded-md bg-slate-50 dark:bg-slate-200">
        <TemplatePreview kind={template.kind} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
          {template.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-300">
          {template.description}
        </p>
      </div>
    </button>
  );
}

// A category tile on the overview: a 2×2 collage of the category's
// previews as the illustration, plus the label and a count. Clicking it
// drills into the category. The `[&_svg]:max-*` rules let each fixed-size
// preview SVG scale down to fit its quarter cell.
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
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Browse ${label} templates`}
      aria-pressed={selected}
      className={
        selected
          ? 'flex flex-col items-start gap-1.5 rounded-lg border-2 border-brand-400 bg-brand-50 p-2 text-left dark:border-brand-500 dark:bg-brand-500/15'
          : 'flex flex-col items-start gap-1.5 rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10'
      }
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
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
            {label}
          </p>
          <span className="shrink-0 text-[11px] font-medium text-slate-400 dark:text-slate-300">
            {count}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-300">
          {description}
        </p>
      </div>
    </button>
  );
}
