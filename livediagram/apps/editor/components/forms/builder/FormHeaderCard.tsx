'use client';

// The top of the form in the builder (docs/specs/030-forms/forms.md "The form card, top to bottom"): the cover (its
// colour and style changed from Change Cover), then the heading (the tab's name too) and description, edited in
// place. A later section's header is SectionHeader.
import { useContext, useMemo, useState } from 'react';
import type { ColourBackground } from '@/lib/form-cover/colour-background';
import {
  FORM_DESCRIPTION_MAX,
  FORM_HEADING_MAX,
  SECTION_TITLE_MAX,
  type FormCover,
  type FormSection,
} from '@livediagram/forms';
import { TrashIcon, Tooltip } from '@livediagram/ui';
import { patchForm, deleteSection, updateSection } from '@livediagram/forms';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';
import { BackgroundSection } from '@/components/forms/cover/cover-background-section';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { themeBackgroundPresets } from '@/lib/form-cover/cover-paint';
import { getTheme } from '@/lib/themes';
import { FormCoverBand } from '../FormCoverBand';
import { LinkedText } from '../LinkedText';
import { FORM_ACCENT } from '../respond/FormFill';
import { DraftText } from './DraftText';
import { SectionRule } from './SectionRule';
import { useFormBuilder } from './form-builder-context';

// Wide enough for the motion tiles and their names to sit three across with room.
const COVER_POPOVER_W = 380;

// The cover with a background patch laid over it; none once it holds neither a fill nor a pattern.
function patchedCover(
  cover: FormCover | undefined,
  patch: Partial<ColourBackground>,
): FormCover | undefined {
  const merged = { ...cover, ...patch };
  const next: FormCover = {
    ...(merged.fill ? { fill: merged.fill } : {}),
    ...(merged.pattern ? { pattern: merged.pattern } : {}),
  };
  return next.fill || next.pattern ? next : undefined;
}

export function FormHeaderCard({ sections }: { sections: number }) {
  const b = useFormBuilder();
  const { form } = b;
  const accent = FORM_ACCENT;
  const [coverAnchor, setCoverAnchor] = useState<HTMLButtonElement | null>(null);
  const [coverOpen, setCoverOpen] = useState(false);
  // A hovered choice, shown on the band until it is picked or left.
  const [preview, setPreview] = useState<Partial<ColourBackground> | null>(null);
  const shownCover = preview ? patchedCover(form.cover, preview) : form.cover;
  // The tab theme's own gradients lead the Gradient choices.
  // Read as the colour picker reads it (useThemeColours): no editor around it (a test) is the default theme.
  const themeId = useContext(EditorContext)?.activeTab?.theme;
  const themePresets = useMemo(() => themeBackgroundPresets(getTheme(themeId)), [themeId]);
  return (
    <div className="form-box form-ink group/head overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
      <div className="relative">
        <FormCoverBand cover={shownCover} accent={accent} className={shownCover ? '' : 'h-2.5'} />
        {b.canEdit ? (
          <button
            ref={setCoverAnchor}
            type="button"
            aria-expanded={coverOpen}
            onClick={() => setCoverOpen((o) => !o)}
            className={`absolute right-3 cursor-pointer rounded-md bg-white/90 px-2.5 py-1 text-[12px] font-medium text-slate-700 shadow-sm transition hover:bg-white focus-visible:opacity-100 dark:bg-slate-900/90 dark:text-slate-200 ${
              form.cover
                ? 'bottom-3 opacity-0 group-hover/head:opacity-100 [@media(hover:none)]:opacity-100'
                : 'top-4 opacity-0 group-hover/head:opacity-100 [@media(hover:none)]:opacity-100'
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
          width={COVER_POPOVER_W}
          onClose={() => {
            setPreview(null);
            setCoverOpen(false);
          }}
        >
          <div className="flex max-h-[min(30rem,calc(100dvh-10rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <p className="text-[14px] font-semibold text-slate-900 dark:text-slate-50">Cover</p>
              {form.cover ? (
                <button
                  type="button"
                  onClick={() => {
                    b.actions.changeForm((f) => patchForm(f, { cover: undefined }));
                    setCoverOpen(false);
                  }}
                  className="cursor-pointer rounded-md px-2 py-1 text-[12px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  Remove Cover
                </button>
              ) : null}
            </div>
            <div className="overflow-y-auto px-4 py-3">
              <BackgroundSection
                background={form.cover}
                themePresets={themePresets}
                onBackground={(patch) => {
                  setPreview(null);
                  b.actions.changeForm((f) =>
                    patchForm(f, { cover: patchedCover(f.cover, patch) }),
                  );
                }}
                onPreview={setPreview}
              />
            </div>
          </div>
        </AnchoredPopover>
      ) : null}
      <div
        className={`px-6 pb-5 pt-5 max-sm:px-4 ${form.cover ? '' : 'border-t-[6px] border-[var(--form-accent)]'}`}
      >
        {sections > 1 ? (
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
            <SectionRule section={section} index={index} />
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
