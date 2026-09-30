import type { TemplateDescriptor, TemplateKind, TemplateShelf } from '@livediagram/templates';
import { TEMPLATE_CATEGORIES, templateCategory, templateShelfLabel } from '@livediagram/templates';
import { AnimatedHeightBox } from '@/components/primitives/AnimatedHeightBox';
import { BackBar } from '@/components/primitives/BackBar';
import { CategoryCard, TemplateCard } from '@/components/palette/template-picker-cards';

// The template step's browse surface, lifted out of TemplatePicker: the
// search input plus the three-way body (flat search results / an open
// category's grid / the category overview with the Blank quick-pick).
// Render-only: the query / category / shuffle state stays in
// TemplatePicker — the wizard remounts this section on every step
// switch (the step container is keyed), so state held here would reset
// when the user peeks at the theme step and comes back.
export function TemplatePickerBrowse({
  showIdentity,
  templateQuery,
  setTemplateQuery,
  templateFilter,
  filteredTemplates,
  openShelf,
  setOpenShelf,
  blankTemplate,
  whiteboardTemplate,
  shelfTemplates,
  templateKind,
  onTemplateCommit,
}: {
  // True when the identity row renders above (adds the separating margin).
  showIdentity: boolean;
  templateQuery: string;
  setTemplateQuery: (q: string) => void;
  // The debounced, normalised filter actually applied (empty = browse).
  templateFilter: string;
  filteredTemplates: TemplateDescriptor[];
  // The category or collection drilled into, or null for the overview.
  openShelf: TemplateShelf | null;
  setOpenShelf: (s: TemplateShelf | null) => void;
  blankTemplate: TemplateDescriptor | undefined;
  // The whiteboard quick-pick beside Blank (docs/specs/023-whiteboard/whiteboard.md).
  whiteboardTemplate: TemplateDescriptor | undefined;
  shelfTemplates: (shelf: TemplateShelf) => TemplateDescriptor[];
  templateKind: TemplateKind;
  // Single-click a template card: select it AND advance to the theme step
  // (docs/specs/006-document/offline-mode.md). The same handler backs double-click, so either gesture works.
  onTemplateCommit: (kind: TemplateKind) => void;
}) {
  return (
    <>
      <div className={`flex items-center justify-between gap-3 ${showIdentity ? 'mt-5' : ''}`}>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Quick Start
        </p>
        <input
          type="text"
          value={templateQuery}
          onChange={(e) => setTemplateQuery(e.target.value)}
          placeholder="Search templates"
          aria-label="Search templates"
          className="w-72 max-w-[70%] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-400"
        />
      </div>
      {/* Two-level browse inside a height-capped scroll area:
          the overview shows a Blank quick-pick + a card per
          category; clicking a category drills into its templates
          (with a Back affordance). A non-empty search query
          overrides both and shows flat results across the whole
          catalogue. Blank is special-cased out of the category
          grouping — it's a "start from scratch", not a category
          template — and lives only on the overview row. */}
      <AnimatedHeightBox
        viewKey={templateFilter ? 'search' : (openShelf ?? 'overview')}
        className="mt-2"
      >
        {templateFilter ? (
          filteredTemplates.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs text-slate-400 dark:text-slate-400">
              No templates match “{templateQuery.trim()}”.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {filteredTemplates.map((t) => (
                <TemplateCard
                  key={t.kind}
                  template={t}
                  active={templateKind === t.kind}
                  onSelect={() => onTemplateCommit(t.kind)}
                  onCommit={() => onTemplateCommit(t.kind)}
                />
              ))}
            </div>
          )
        ) : openShelf ? (
          <>
            <BackBar
              label="All templates"
              current={templateShelfLabel(openShelf)}
              onClick={() => setOpenShelf(null)}
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {shelfTemplates(openShelf).map((t) => (
                <TemplateCard
                  key={t.kind}
                  template={t}
                  active={templateKind === t.kind}
                  onSelect={() => onTemplateCommit(t.kind)}
                  onCommit={() => onTemplateCommit(t.kind)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {blankTemplate ? (
              <TemplateCard
                template={blankTemplate}
                active={templateKind === 'blank'}
                onSelect={() => onTemplateCommit('blank')}
                onCommit={() => onTemplateCommit('blank')}
              />
            ) : null}
            {TEMPLATE_CATEGORIES.map((cat) => {
              const items = shelfTemplates(cat.id);
              if (items.length === 0) return null;
              return (
                <CategoryCard
                  key={cat.id}
                  label={cat.label}
                  description={cat.description}
                  count={items.length}
                  previews={items.map((t) => t.kind)}
                  selected={
                    templateKind !== 'blank' &&
                    templateKind !== 'whiteboard' &&
                    templateCategory(templateKind) === cat.id
                  }
                  onOpen={() => setOpenShelf(cat.id)}
                />
              );
            })}
            {/* A whiteboard is a different activity from the diagram templates:
                last, after every category (docs/specs/023-whiteboard/whiteboard.md "Creating one"). */}
            {whiteboardTemplate ? (
              <TemplateCard
                template={whiteboardTemplate}
                active={templateKind === 'whiteboard'}
                onSelect={() => onTemplateCommit('whiteboard')}
                onCommit={() => onTemplateCommit('whiteboard')}
              />
            ) : null}
          </div>
        )}
      </AnimatedHeightBox>
    </>
  );
}
