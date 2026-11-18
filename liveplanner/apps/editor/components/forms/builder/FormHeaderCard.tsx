'use client';

// The top of the form in the builder (docs/specs/030-forms/forms.md "The form card, top to bottom"): the cover (its
// colour and style changed from Change Cover), then the heading (the tab's name too) and description, edited in
// place. A later section's header is SectionHeader.
import { useContext, useMemo, useState } from 'react';
import {
  FORM_DESCRIPTION_MAX,
  FORM_HEADING_MAX,
  SECTION_TITLE_MAX,
  type FormCover,
  type FormSection,
} from '@liveplanner/forms';
import { ArrowDownIcon, ArrowUpIcon, TrashIcon, Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideGripVertical, lucideImage } from '@liveworkspace/icons/lucide';
import { patchForm, deleteSection, moveSection, updateSection } from '@liveplanner/forms';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { BackgroundSection } from '@/components/canvas/page-background-section';
import { EditorContext } from '@/app/project/[id]/EditorContext';
import { themeBackgroundPresets } from '@/lib/page-paint';
import { getTheme } from '@/lib/themes';
import { FormCoverBand } from '../FormCoverBand';
import { useFormImage } from '../form-images';
import { FormImagePicker } from './FormImagePicker';
import { LinkedText } from '../LinkedText';
import { FORM_ACCENT } from '../respond/FormFill';
import { DraftText } from './DraftText';
import { SectionRule } from './SectionRule';
import { useFormBuilder } from './form-builder-context';

const GripIcon = lucideGlyph(lucideGripVertical, 14);
const PictureIcon = lucideGlyph(lucideImage, 18);

// Wide enough for the motion tiles and their names to sit three across with room.
const COVER_POPOVER_W = 380;

// The cover with a patch laid over it (a background's, or its picture's); none once it holds no fill, pattern or
// picture. A picture's focus and credit go with it.
function patchedCover(
  cover: FormCover | undefined,
  patch: Partial<FormCover>,
): FormCover | undefined {
  const merged = { ...cover, ...patch };
  const next: FormCover = {
    ...(merged.fill ? { fill: merged.fill } : {}),
    ...(merged.pattern ? { pattern: merged.pattern } : {}),
    ...(merged.imageId
      ? {
          imageId: merged.imageId,
          ...(merged.focus !== undefined && merged.focus !== 50 ? { focus: merged.focus } : {}),
          ...(merged.credit ? { credit: merged.credit } : {}),
        }
      : {}),
  };
  return next.fill || next.pattern || next.imageId ? next : undefined;
}

export function FormHeaderCard() {
  const b = useFormBuilder();
  const { form } = b;
  const accent = FORM_ACCENT;
  const [coverAnchor, setCoverAnchor] = useState<HTMLButtonElement | null>(null);
  const [coverOpen, setCoverOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  // A hovered choice, shown on the band until it is picked or left.
  const [preview, setPreview] = useState<Partial<FormCover> | null>(null);
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
              <CoverPicture
                cover={form.cover}
                onChoose={() => {
                  setCoverOpen(false);
                  setPicking(true);
                }}
                onRemove={() =>
                  b.actions.changeForm((f) =>
                    patchForm(f, {
                      cover: patchedCover(f.cover, {
                        imageId: undefined,
                        focus: undefined,
                        credit: undefined,
                      }),
                    }),
                  )
                }
                onFocus={(focus) =>
                  b.actions.changeForm((f) =>
                    patchForm(f, { cover: patchedCover(f.cover, { focus }) }),
                  )
                }
                onFocusPreview={(focus) => setPreview(focus === null ? null : { focus })}
              />
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
      {picking ? (
        <FormImagePicker
          title={form.cover?.imageId ? 'Change Cover Picture' : 'Add Cover Picture'}
          onClose={() => setPicking(false)}
          onPick={({ id, credit }) => {
            setPicking(false);
            b.actions.changeForm((f) =>
              patchForm(f, {
                cover: patchedCover(f.cover, { imageId: id, focus: undefined, credit }),
              }),
            );
          }}
        />
      ) : null}
      <div
        className={`px-6 pb-5 pt-5 max-sm:px-4 ${form.cover ? '' : 'border-t-[6px] border-[var(--form-accent)]'}`}
      >
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

// A section's header, drawn for every section once the form has more than one (docs/specs/030-forms/forms.md
// "Reordering sections"): "Section 2 of 3" on a band in the form colour with the section's grip (drag it to reorder),
// Move Up, Move Down and Delete Section (its questions join the section before; the first section has none), then its
// title, description and, after the first, its rule.
export function SectionHeader({
  section,
  index,
  count,
  onGrab,
  dragging = false,
}: {
  section: FormSection;
  index: number;
  count: number;
  onGrab?: (e: React.PointerEvent, id: string, from: number) => void;
  dragging?: boolean;
}) {
  const b = useFormBuilder();
  const name = section.title || `Section ${index + 1}`;
  const band =
    'flex h-7 w-7 cursor-pointer items-center justify-center rounded-md opacity-85 transition hover:bg-white/20 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent';
  return (
    <div
      className={`form-box form-ink overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-opacity dark:border-slate-700/80 dark:bg-slate-900 ${index > 0 ? 'mt-4' : ''} ${dragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-center gap-1 bg-[var(--form-accent)] py-1 pl-1.5 pr-1.5 text-[12px] font-semibold text-[var(--form-on-accent)]">
        {b.canEdit && onGrab ? (
          <Tooltip label="Drag to Reorder">
            <button
              type="button"
              aria-label={`Drag ${name} to reorder`}
              onPointerDown={(e) => onGrab(e, section.id, index)}
              className={`${band} cursor-grab touch-none active:cursor-grabbing`}
            >
              <GripIcon aria-hidden />
            </button>
          </Tooltip>
        ) : null}
        <span className="min-w-0 flex-1 truncate px-1">
          Section {index + 1} of {count}
        </span>
        {b.canEdit ? (
          <>
            <Tooltip label="Move Section Up">
              <button
                type="button"
                aria-label={`Move ${name} up`}
                disabled={index === 0}
                onClick={() => b.actions.changeForm((f) => moveSection(f, section.id, -1))}
                className={band}
              >
                <ArrowUpIcon size={15} />
              </button>
            </Tooltip>
            <Tooltip label="Move Section Down">
              <button
                type="button"
                aria-label={`Move ${name} down`}
                disabled={index === count - 1}
                onClick={() => b.actions.changeForm((f) => moveSection(f, section.id, 1))}
                className={band}
              >
                <ArrowDownIcon size={15} />
              </button>
            </Tooltip>
            {index > 0 ? (
              <Tooltip label="Delete Section">
                <button
                  type="button"
                  aria-label={`Delete section ${index + 1}`}
                  onClick={() => b.actions.changeForm((f) => deleteSection(f, section.id))}
                  className={band}
                >
                  <TrashIcon size={14} />
                </button>
              </Tooltip>
            ) : null}
          </>
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
            {index > 0 ? <SectionRule section={section} index={index} /> : null}
          </>
        ) : (
          <>
            <h2 className="text-[20px] font-semibold text-slate-900 dark:text-slate-50">{name}</h2>
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

// The cover popover's Picture (forms.md "Cover"): the picture with Change and Remove, and where it sits (its focus,
// previewed on the band while dragged); or Add Picture. A colour or pattern below still shows where the picture is
// transparent or loading.
function CoverPicture({
  cover,
  onChoose,
  onRemove,
  onFocus,
  onFocusPreview,
}: {
  cover: FormCover | undefined;
  onChoose: () => void;
  onRemove: () => void;
  onFocus: (focus: number) => void;
  onFocusPreview: (focus: number | null) => void;
}) {
  const src = useFormImage(cover?.imageId);
  const [focus, setFocus] = useState<number | null>(null);
  const shown = focus ?? cover?.focus ?? 50;
  const PICTURE_BTN =
    'cursor-pointer rounded-md px-2.5 py-1 text-[12px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50';
  if (!cover?.imageId)
    return (
      <button
        type="button"
        onClick={onChoose}
        className="mb-4 flex w-full cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-left transition hover:border-brand-400 hover:bg-brand-50/50 dark:border-slate-600 dark:hover:bg-brand-500/10"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <PictureIcon aria-hidden />
        </span>
        <span>
          <span className="block text-[13px] font-semibold text-slate-800 dark:text-slate-100">
            Add Picture
          </span>
          <span className="block text-[12px] text-slate-500 dark:text-slate-400">
            Upload one, pick from your images, or search.
          </span>
        </span>
      </button>
    );
  return (
    <div className="mb-4">
      <p className="mb-2 text-[12px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        Picture
      </p>
      <div className="flex items-center gap-3">
        <span className="block h-14 w-24 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
          {src ? (
            <img
              src={src}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: `50% ${shown}%` }}
            />
          ) : null}
        </span>
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={onChoose} className={PICTURE_BTN}>
            Change
          </button>
          <button type="button" onClick={onRemove} className={PICTURE_BTN}>
            Remove
          </button>
        </div>
      </div>
      <label className="mt-3 flex items-center gap-3 text-[12px] font-medium text-slate-600 dark:text-slate-300">
        <span className="shrink-0">Position</span>
        <input
          type="range"
          min={0}
          max={100}
          value={shown}
          aria-valuetext={shown < 34 ? 'Top' : shown > 66 ? 'Bottom' : 'Middle'}
          onChange={(e) => {
            const v = Number(e.target.value);
            setFocus(v);
            onFocusPreview(v);
          }}
          onPointerUp={() => {
            if (focus !== null) onFocus(focus);
            setFocus(null);
            onFocusPreview(null);
          }}
          onKeyUp={() => {
            if (focus !== null) onFocus(focus);
            setFocus(null);
            onFocusPreview(null);
          }}
          className="w-full cursor-pointer accent-brand-600"
        />
      </label>
      {cover.credit ? (
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{cover.credit}</p>
      ) : null}
    </div>
  );
}
