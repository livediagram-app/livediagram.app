import type { TemplateDescriptor, TemplateCategory, TemplateKind } from '@livediagram/templates';
import { TEMPLATE_CATEGORIES, templateCategory } from '@livediagram/templates';
import { AnimatedHeightBox } from '@/components/primitives/AnimatedHeightBox';
import { BackBar } from '@/components/palette/ThemeCategoryBrowser';
import {
  CategoryCard,
  GuidedTourCard,
  TemplateCard,
} from '@/components/palette/template-picker-cards';

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
  openCategory,
  setOpenCategory,
  blankTemplate,
  categoryTemplates,
  templateKind,
  setTemplateKind,
  onTemplateCommit,
  onGuidedTour,
}: {
  // True when the identity row renders above (adds the separating margin).
  showIdentity: boolean;
  templateQuery: string;
  setTemplateQuery: (q: string) => void;
  // The debounced, normalised filter actually applied (empty = browse).
  templateFilter: string;
  filteredTemplates: TemplateDescriptor[];
  openCategory: TemplateCategory | null;
  setOpenCategory: (c: TemplateCategory | null) => void;
  blankTemplate: TemplateDescriptor | undefined;
  categoryTemplates: (category: TemplateCategory) => TemplateDescriptor[];
  templateKind: TemplateKind;
  setTemplateKind: (kind: TemplateKind) => void;
  onTemplateCommit: (kind: TemplateKind) => void;
  // Welcome mode only (spec/69): renders the "Show me around" card on the
  // overview beside Blank. One click commits the guided-tour sample with
  // the default theme, skipping the theme step entirely.
  onGuidedTour?: () => void;
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
          className="w-72 max-w-[70%] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500"
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
        viewKey={templateFilter ? 'search' : (openCategory ?? 'overview')}
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
                  onSelect={() => setTemplateKind(t.kind)}
                  onCommit={() => onTemplateCommit(t.kind)}
                />
              ))}
            </div>
          )
        ) : openCategory ? (
          <>
            <BackBar
              label="All templates"
              current={
                TEMPLATE_CATEGORIES.find((c) => c.id === openCategory)?.label ?? openCategory
              }
              onClick={() => setOpenCategory(null)}
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {categoryTemplates(openCategory).map((t) => (
                <TemplateCard
                  key={t.kind}
                  template={t}
                  active={templateKind === t.kind}
                  onSelect={() => setTemplateKind(t.kind)}
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
                onSelect={() => setTemplateKind('blank')}
                onCommit={() => onTemplateCommit('blank')}
              />
            ) : null}
            {onGuidedTour ? <GuidedTourCard onStart={onGuidedTour} /> : null}
            {TEMPLATE_CATEGORIES.map((cat) => {
              const items = categoryTemplates(cat.id);
              if (items.length === 0) return null;
              return (
                <CategoryCard
                  key={cat.id}
                  label={cat.label}
                  description={cat.description}
                  count={items.length}
                  previews={items.map((t) => t.kind)}
                  selected={templateKind !== 'blank' && templateCategory(templateKind) === cat.id}
                  onOpen={() => setOpenCategory(cat.id)}
                />
              );
            })}
          </div>
        )}
      </AnimatedHeightBox>
    </>
  );
}
