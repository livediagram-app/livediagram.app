// Card primitives for the template picker's browse: a selectable
// TemplateCard (preview + title + description) and a CategoryTile (a fanned
// stack of the category's previews that opens it). Lifted out of
// TemplatePicker so the same card renders in the open shelf's carousel
// and the flat search results without the JSX being copy-pasted.

import { EDITOR_MODE_ICONS } from '@livediagram/ui';
import type { TemplateDescriptor, TemplateKind } from '@livediagram/templates';
import { templateEditorMode } from '@livediagram/templates';
import { editorModeLabel, type EditorMode } from '@livediagram/document';
import { PickerCard } from '@/components/palette/PickerCard';
import { PreviewFan, TemplatePreview } from '@livediagram/template-previews';

// The editor mode a template opens in, as the glyph left of its title
// (docs/specs/007-editor/templates-by-mode.md "The mode on a card"): the mode switch's glyph,
// muted. A picture only: a screen reader hears "Opens in <Mode>" after the title (the card's
// labelNote), so a card's name still starts with its title.
function TemplateModeGlyph({ mode }: { mode: EditorMode }) {
  const Icon = EDITOR_MODE_ICONS[mode];
  return (
    <span
      aria-hidden
      data-template-mode={mode}
      className="mt-px inline-flex shrink-0 text-slate-400 dark:text-slate-400"
    >
      <Icon size={14} />
    </span>
  );
}

// A single selectable template tile. Click selects; double-click is the
// commit shortcut (select + Create in one gesture). `large` is the open
// category's carousel card: a taller preview, stretched to the row's height.
export function TemplateCard({
  template,
  active,
  onSelect,
  onCommit,
  large = false,
}: {
  template: TemplateDescriptor;
  active: boolean;
  onSelect: () => void;
  onCommit: () => void;
  large?: boolean;
}) {
  return (
    <PickerCard
      active={active}
      onSelect={onSelect}
      onCommit={onCommit}
      label={template.title}
      description={template.description}
      clampDescription={false}
      className={large ? 'h-full w-full' : ''}
      labelIcon={<TemplateModeGlyph mode={templateEditorMode(template.kind)} />}
      labelNote={`Opens in ${editorModeLabel(templateEditorMode(template.kind))}`}
    >
      {/* An illustrative mini-canvas drawn as light-canvas art. In dark
          chrome the whole tile is re-lit by `.preview-art-tile`
          (globals.css) rather than redrawn, so it reads as a dark canvas
          with its hues intact. Hovering or focusing the card plays the
          template's story (`preview-motion`, docs/specs/019-marketing/marketing-site.md), as the landing
          page's gallery does; the category fans stay still, since three
          stories at once in one small tile would be noise. */}
      <div
        className={`preview-art-tile preview-motion flex w-full items-center justify-center rounded-md bg-slate-50 ${
          large ? 'h-24 [&>svg]:h-[4.5rem] [&>svg]:w-auto' : 'h-14'
        }`}
      >
        <TemplatePreview kind={template.kind} />
      </div>
    </PickerCard>
  );
}

// A folded shelf under the open one (the landing page's "Explore more
// categories" cards, docs/specs/019-marketing/marketing-site.md, in the picker's chrome): the
// shared PreviewFan over the name and a count. Clicking opens it in the
// stage above.
export function CategoryTile({
  label,
  ariaLabel,
  count,
  description,
  kinds,
  onOpen,
}: {
  label: string;
  ariaLabel: string;
  // A shelf's template count; absent for a tile that starts something itself (Whiteboard).
  count?: number;
  // One muted line under the name, for a tile that is not a shelf.
  description?: string;
  // The shelf's templates; the first three make the fan. A tile of one kind (Whiteboard, its
  // own category) shows that one preview alone, filling the plate, never a fan.
  kinds: readonly TemplateKind[];
  onOpen: () => void;
}) {
  const single = kinds.length === 1 ? kinds[0] : undefined;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={ariaLabel}
      className="group flex h-full w-full min-w-0 flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10"
    >
      {single ? (
        <span
          data-optical-ignore=""
          data-single-preview=""
          className="preview-art-tile flex h-16 w-full items-center justify-center overflow-hidden rounded-md bg-slate-50 [&>svg]:h-14 [&>svg]:w-auto"
        >
          <TemplatePreview kind={single} />
        </span>
      ) : (
        <PreviewFan
          kinds={kinds}
          plateClassName="h-16 w-full rounded-md"
          cardClassName="h-10 [&>svg]:h-7"
        />
      )}
      <span className="mt-auto flex w-full min-w-0 items-center justify-between gap-1">
        <span className="line-clamp-2 min-w-0 break-words text-xs font-semibold leading-4 text-slate-900 dark:text-slate-100">
          {label}
        </span>
        {count !== undefined ? (
          <span className="shrink-0 rounded-full bg-brand-50 px-1.5 py-px text-[10px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
            {count}
          </span>
        ) : null}
      </span>
      {description ? (
        <span className="-mt-1 line-clamp-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
          {description}
        </span>
      ) : null}
    </button>
  );
}
