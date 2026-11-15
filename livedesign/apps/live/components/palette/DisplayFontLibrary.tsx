'use client';

// The display library in a logo page text's Font section (docs/specs/007-editor/logo-pages.md "Display faces"): a
// search, the category chips and a list of the faces, each named in its own face. A hover previews the face on the
// element, a press sets it. Rows preview from a few letters of each face, and a row scrolled out of view fetches
// nothing (content-visibility), so opening the library costs a handful of small files.
import { useEffect, useMemo, useState } from 'react';
import {
  DISPLAY_FONT_CATEGORIES,
  DISPLAY_FONTS,
  type DisplayFont,
  type DisplayFontCategory,
} from '@livedesign/design';
import { NoMatches } from '@livedesign/ui';
import { CategoryChips } from '@liveworkspace/workbench/components/primitives/CategoryChips';
import { SearchInput } from '@liveworkspace/workbench/components/primitives/SearchInput';
import { onMouseHover } from '@liveworkspace/workbench/components/primitives/hover-preview';
import { useMenuItemProps } from '@liveworkspace/workbench/components/primitives/menu-item-props';
import {
  displayPreviewFamily,
  loadDisplayFonts,
  loadDisplayPreviews,
} from '@/lib/display-fonts-loader';

// The list's tallest, in px: about six rows in view inside a menu flyout.
export const DISPLAY_LIBRARY_LIST_MAX_PX = 240;
const ALL = 'all';

const CATEGORY_LABEL = new Map(DISPLAY_FONT_CATEGORIES.map((c) => [c.id, c.label] as const));

/** The faces matching every typed word, in their name, style or category. */
export function matchDisplayFonts(query: string): DisplayFont[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...DISPLAY_FONTS];
  return DISPLAY_FONTS.filter((f) => {
    const hay = `${f.label} ${f.kind} ${CATEGORY_LABEL.get(f.category)}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export function DisplayFontLibrary({
  currentFont,
  onSetFont,
  onPreviewFont,
  onPreviewEnd,
}: {
  currentFont: string | null;
  onSetFont: (font: string) => void;
  onPreviewFont?: (font: string) => void;
  onPreviewEnd?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>(ALL);
  useEffect(() => {
    void loadDisplayPreviews();
  }, []);
  const matching = useMemo(() => matchDisplayFonts(query), [query]);
  const chips = useMemo(
    () => [
      { id: ALL, label: 'All', count: matching.length },
      ...DISPLAY_FONT_CATEGORIES.map((c) => ({
        id: c.id,
        label: c.label,
        count: matching.filter((f) => f.category === c.id).length,
      })),
    ],
    [matching],
  );
  const shown =
    category === ALL
      ? matching
      : matching.filter((f) => f.category === (category as DisplayFontCategory));
  return (
    <div className="flex flex-col gap-2 px-2 pb-2 pt-1">
      <p className="px-1 pt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
        Display Library
      </p>
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder={`Search ${DISPLAY_FONTS.length} display faces`}
        ariaLabel="Search display faces"
        clearAriaLabel="Clear the display face search"
        clearDescription="Show every display face again."
      />
      <CategoryChips
        chips={chips}
        value={category}
        onChoose={setCategory}
        ariaLabel="Display face categories"
      />
      <div
        role="group"
        aria-label="Display faces"
        className="-mx-1 flex flex-col gap-0.5 overflow-y-auto px-1"
        style={{ maxHeight: DISPLAY_LIBRARY_LIST_MAX_PX }}
        onPointerLeave={onMouseHover(() => onPreviewEnd?.())}
      >
        {shown.length === 0 ? (
          <NoMatches
            things="display faces"
            query={query}
            filters={category === ALL ? 0 : 1}
            clearsBoth
            onClear={() => {
              setQuery('');
              setCategory(ALL);
            }}
            className="py-4"
          />
        ) : (
          shown.map((f) => (
            <DisplayFontRow
              key={f.id}
              font={f}
              active={currentFont === f.id}
              onSet={onSetFont}
              onPreview={onPreviewFont}
              onPreviewEnd={onPreviewEnd}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DisplayFontRow({
  font,
  active,
  onSet,
  onPreview,
  onPreviewEnd,
}: {
  font: DisplayFont;
  active: boolean;
  onSet: (font: string) => void;
  onPreview?: (font: string) => void;
  onPreviewEnd?: () => void;
}) {
  const { inCommandMenu, itemProps } = useMenuItemProps({ checked: active, radio: true });
  return (
    <button
      type="button"
      {...itemProps}
      aria-pressed={inCommandMenu ? undefined : active}
      onPointerEnter={onMouseHover(() => {
        loadDisplayFonts([font.id]);
        onPreview?.(font.id);
      })}
      onPointerLeave={onMouseHover(() => onPreviewEnd?.())}
      onClick={() => {
        loadDisplayFonts([font.id]);
        onSet(font.id);
      }}
      // Off screen, a row is not laid out, so its preview face is not fetched until it scrolls into view.
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 36px' }}
      className={`flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1 text-left transition ${
        active
          ? 'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-100'
          : 'text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      <span
        className="min-w-0 truncate text-[17px] leading-snug"
        style={{ fontFamily: `'${displayPreviewFamily(font.id)}', ${font.stack}` }}
      >
        {font.label}
      </span>
      <span
        className={`shrink-0 text-[10px] ${active ? 'text-brand-700 dark:text-brand-200' : 'text-slate-500 dark:text-slate-400'}`}
      >
        {font.kind}
      </span>
    </button>
  );
}
