'use client';

// The top of the form in the builder (docs/specs/030-forms/forms.md "The form card, top to bottom"): the cover (its
// colour and style changed from Change Cover), then the heading (the tab's name too) and description, edited in
// place. A later section's header is SectionHeader.
import { useState } from 'react';
import {
  COVER_STYLES,
  FORM_DESCRIPTION_MAX,
  FORM_HEADING_MAX,
  SECTION_TITLE_MAX,
  type CoverStyle,
  type FormSection,
} from '@livediagram/forms';
import { TrashIcon, Tooltip } from '@livediagram/ui';
import { patchForm, deleteSection, updateSection } from '@/hooks/forms/form-edits';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';
import { ColourSelect } from '@/components/plan/ColourSwatches';
import { PAGE_GRADIENT_PRESETS } from '@/lib/illustrate-page-paint';
import { FormCoverBand } from '../FormCoverBand';
import { LinkedText } from '../LinkedText';
import { FORM_ACCENT } from '../respond/FormFill';
import { DraftText } from './DraftText';
import { useFormBuilder } from './form-builder-context';

const STYLE_NAMES: Record<CoverStyle, string> = {
  solid: 'Solid',
  gradient: 'Gradient',
  dots: 'Dots',
};

export function FormHeaderCard({ sections }: { sections: number }) {
  const b = useFormBuilder();
  const { form } = b;
  const accent = FORM_ACCENT;
  const [coverAnchor, setCoverAnchor] = useState<HTMLButtonElement | null>(null);
  const [coverOpen, setCoverOpen] = useState(false);
  return (
    <div className="form-box form-ink group/head overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
      <div className="relative">
        <FormCoverBand cover={form.cover} accent={accent} className={form.cover ? '' : 'h-2.5'} />
        {b.canEdit ? (
          <button
            ref={setCoverAnchor}
            type="button"
            aria-expanded={coverOpen}
            onClick={() => setCoverOpen((o) => !o)}
            className={`absolute right-3 cursor-pointer rounded-md bg-white/90 px-2.5 py-1 text-[12px] font-medium text-slate-700 shadow-sm transition hover:bg-white focus-visible:opacity-100 dark:bg-slate-900/90 dark:text-slate-200 ${
              form.cover
                ? 'bottom-3 opacity-0 group-hover/head:opacity-100'
                : 'top-4 opacity-0 group-hover/head:opacity-100'
            }`}
          >
            {form.cover ? 'Change Cover' : 'Add Cover'}
          </button>
        ) : null}
      </div>
      {coverOpen && coverAnchor ? (
        <AnchoredPopover
          anchor={coverAnchor}
          name="Cover"
          width={280}
          onClose={() => setCoverOpen(false)}
        >
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div>
              <p className="mb-1.5 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                Cover Colour
              </p>
              <ColourSelect
                label="Cover Colour"
                value={form.cover?.color}
                onChange={(color) =>
                  b.actions.changeForm((f) =>
                    patchForm(f, {
                      cover: {
                        ...f.cover,
                        ...(color ? { color } : { color: undefined }),
                        gradient: undefined,
                      },
                    }),
                  )
                }
              />
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                None takes the theme’s colour.
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                Style
              </p>
              <div role="radiogroup" aria-label="Cover style" className="grid grid-cols-3 gap-1.5">
                {COVER_STYLES.map((s) => {
                  const on = !form.cover?.gradient && (form.cover?.style ?? 'solid') === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() =>
                        b.actions.changeForm((f) =>
                          patchForm(f, {
                            cover: {
                              ...f.cover,
                              ...(s === 'solid' ? { style: undefined } : { style: s }),
                              gradient: undefined,
                            },
                          }),
                        )
                      }
                      className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-1.5 text-[11px] font-medium ${
                        on
                          ? 'border-brand-400 bg-brand-50 text-brand-800 dark:border-brand-500/60 dark:bg-brand-500/10 dark:text-brand-100'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="h-6 w-full overflow-hidden rounded">
                        <FormCoverBand
                          cover={{ color: form.cover?.color ?? accent, style: s }}
                          accent={accent}
                          className="!h-6"
                        />
                      </span>
                      {STYLE_NAMES[s]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                Gradients
              </p>
              {/* The slide backgrounds' gradients (docs/specs/007-editor/illustrate-pages.md "Backgrounds"). */}
              <div
                role="radiogroup"
                aria-label="Cover gradient"
                className="grid grid-cols-7 gap-1.5"
              >
                {PAGE_GRADIENT_PRESETS.map((g) => {
                  const on =
                    form.cover?.gradient?.from === g.from && form.cover.gradient.to === g.to;
                  return (
                    <Tooltip key={g.id} label={g.label}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={g.label}
                        onClick={() =>
                          b.actions.changeForm((f) =>
                            patchForm(f, { cover: { gradient: { from: g.from, to: g.to } } }),
                          )
                        }
                        className={`h-7 cursor-pointer rounded-md ring-offset-1 transition hover:scale-105 dark:ring-offset-slate-900 ${
                          on ? 'ring-2 ring-brand-500' : 'ring-1 ring-black/10 dark:ring-white/15'
                        }`}
                        style={{ background: `linear-gradient(120deg, ${g.from}, ${g.to})` }}
                      />
                    </Tooltip>
                  );
                })}
              </div>
            </div>
            {form.cover ? (
              <button
                type="button"
                onClick={() => {
                  b.actions.changeForm((f) => patchForm(f, { cover: undefined }));
                  setCoverOpen(false);
                }}
                className="cursor-pointer self-start text-[12px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Remove Cover
              </button>
            ) : null}
          </div>
        </AnchoredPopover>
      ) : null}
      <div
        className={`px-6 pb-5 pt-5 max-sm:px-4 ${form.cover ? '' : 'border-t-[6px] border-[var(--form-accent)]'}`}
      >
        {sections > 1 ? (
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-slate-400">
            Section 1 of {sections}
          </p>
        ) : null}
        {b.canEdit ? (
          <>
            <DraftText
              value={form.heading}
              maxLength={FORM_HEADING_MAX}
              label="Form heading"
              placeholder="Form heading"
              className="border-b border-transparent pb-1 text-[28px] font-semibold tracking-tight text-slate-900 focus:border-[var(--form-accent)] max-sm:text-[24px] dark:text-slate-50"
              onSave={(text) => text.trim() && b.actions.renameForm(text)}
            />
            <DraftText
              value={form.description ?? ''}
              maxLength={FORM_DESCRIPTION_MAX}
              multiline
              label="Form description"
              placeholder="Add a description"
              className="mt-2 border-b border-transparent pb-1 text-[15px] leading-relaxed text-slate-600 focus:border-[var(--form-accent)] dark:text-slate-300"
              onSave={(text) =>
                b.actions.changeForm((f) => patchForm(f, { description: text.trim() || undefined }))
              }
            />
          </>
        ) : (
          <>
            <h1 className="text-[28px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {form.heading}
            </h1>
            {form.description ? (
              <LinkedText
                text={form.description}
                className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300"
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

// A later section's header: "Section 2 of 3", its title and description, and Delete Section (its questions join the
// section before).
export function SectionHeader({
  section,
  index,
  count,
}: {
  section: FormSection;
  index: number;
  count: number;
}) {
  const b = useFormBuilder();
  return (
    <div className="form-box form-ink mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
      <div className="flex items-center justify-between bg-[var(--form-accent)] px-4 py-1.5 text-[12px] font-semibold text-[var(--form-on-accent)]">
        <span>
          Section {index + 1} of {count}
        </span>
        {b.canEdit ? (
          <Tooltip label="Delete Section">
            <button
              type="button"
              aria-label={`Delete section ${index + 1}`}
              onClick={() => b.actions.changeForm((f) => deleteSection(f, section.id))}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded opacity-80 hover:bg-white/20 hover:opacity-100"
            >
              <TrashIcon size={14} />
            </button>
          </Tooltip>
        ) : null}
      </div>
      <div className="px-6 pb-4 pt-3 max-sm:px-4">
        {b.canEdit ? (
          <>
            <DraftText
              value={section.title}
              maxLength={SECTION_TITLE_MAX}
              label={`Section ${index + 1} title`}
              placeholder={`Section ${index + 1}`}
              className="border-b border-transparent pb-1 text-[20px] font-semibold text-slate-900 focus:border-[var(--form-accent)] dark:text-slate-50"
              onSave={(text) =>
                b.actions.changeForm((f) => updateSection(f, section.id, { title: text.trim() }))
              }
            />
            <DraftText
              value={section.description ?? ''}
              maxLength={FORM_DESCRIPTION_MAX}
              multiline
              label={`Section ${index + 1} description`}
              placeholder="Description (optional)"
              className="mt-1 text-[14px] text-slate-600 dark:text-slate-300"
              onSave={(text) =>
                b.actions.changeForm((f) =>
                  updateSection(f, section.id, { description: text.trim() }),
                )
              }
            />
          </>
        ) : (
          <>
            <h2 className="text-[20px] font-semibold text-slate-900 dark:text-slate-50">
              {section.title || `Section ${index + 1}`}
            </h2>
            {section.description ? (
              <LinkedText
                text={section.description}
                className="mt-1 text-[14px] text-slate-600 dark:text-slate-300"
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
