'use client';

// A gallery's frame (docs/specs/026-plan/board-widgets.md "The widget gallery", item-types.md "Fields and Tabs": Add
// Field), shared by Add a Widget and Add Field: a header with the title, its line, a search beside them and a close
// cross, then the rail down the left and the list beside it (the rail a row of chips over the list in a gallery under
// 600 px wide), and a polite line said to a screen reader. The gallery fills the popover it sits in, or, given
// `dialogHero`, the modal (Add Field's): the modal's panel draws the box, the title, its line and the close are the
// dialog hero header's (liveworkspace/docs/specs/004-index/dialog-hero-header.md), and the search has a row of its own
// under it.
import type { ComponentProps, KeyboardEvent, ReactNode, Ref } from 'react';
import { CloseIcon, lucideGlyph } from '@liveplanner/ui';
import { HeroDialogHeader, type HeroArt } from '@liveworkspace/ui/dialog-hero';
import { lucideSearch } from '@liveworkspace/icons/lucide';

const SearchGlyph = lucideGlyph(lucideSearch, 14);

// Add a Widget's and Add Field's popover width (narrower in a narrower window).
export const GALLERY_WIDTH = 720;

export function GalleryFrame({
  title,
  line,
  search,
  searchRef,
  onClose,
  rail,
  said,
  dialogHero,
  children,
}: {
  title: string;
  line: string;
  search: {
    // Its accessible name and placeholder.
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
    autoFocus?: boolean;
  };
  searchRef?: Ref<HTMLInputElement>;
  onClose?: (() => void) | undefined;
  rail?: ReactNode;
  // Said to a screen reader as it changes (what a press did, how many match).
  said?: string;
  // In a modal: the hero header's art, and the id its heading takes, for the dialog's aria-labelledby.
  dialogHero?: { titleId: string; art: HeroArt } | undefined;
  children: ReactNode;
}) {
  const inDialog = dialogHero !== undefined;
  const searchBox = (
    <label
      className={`flex h-8 pointer-coarse:h-auto min-w-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-400 transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/30 motion-reduce:transition-none dark:border-slate-700 ${
        inDialog ? 'w-full' : 'w-56 @max-[600px]:w-auto @max-[600px]:flex-1'
      }`}
    >
      <SearchGlyph />
      <input
        ref={searchRef}
        type="search"
        autoFocus={search.autoFocus}
        autoComplete="off"
        aria-label={search.label}
        placeholder={search.placeholder}
        value={search.value}
        onChange={(e) => search.onChange(e.target.value)}
        onKeyDown={search.onKeyDown}
        className="min-w-0 flex-1 bg-transparent text-[12px] text-slate-800 outline-none placeholder:text-slate-400 pointer-coarse:min-h-8 dark:text-slate-100 [&::-webkit-search-cancel-button]:hidden"
      />
    </label>
  );
  return (
    <div
      className={`@container flex flex-col overflow-hidden text-slate-900 dark:text-slate-50 ${
        inDialog
          ? 'min-h-0 flex-1'
          : 'max-h-[min(76vh,40rem)] rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900'
      }`}
    >
      {dialogHero ? (
        <>
          <HeroDialogHeader
            art={dialogHero.art}
            titleId={dialogHero.titleId}
            title={title}
            subtitle={line}
            onClose={onClose}
            underHandle
          />
          <div className="shrink-0 border-b border-slate-100 px-5 py-3 max-sm:px-4 dark:border-slate-800">
            {searchBox}
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 px-4 pb-3 pt-3.5 dark:border-slate-800">
          <div className="min-w-[12rem] flex-1">
            <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">{line}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 @max-[600px]:w-full">
            {searchBox}
            {onClose ? (
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 motion-reduce:transition-none pointer-coarse:size-11 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <CloseIcon size={12} />
              </button>
            ) : null}
          </div>
        </div>
      )}
      <div className="flex min-h-[18rem] flex-1 overflow-hidden @max-[600px]:flex-col">
        {rail}
        {children}
      </div>
      <span className="sr-only" aria-live="polite">
        {said}
      </span>
    </div>
  );
}

// The gallery's list beside the rail: it scrolls on its own, padded for tiles (`bare` for a form that pads itself).
export function GalleryList({
  bare = false,
  className = '',
  ...rest
}: ComponentProps<'div'> & { bare?: boolean }) {
  return (
    <div
      data-gallery-list=""
      {...rest}
      className={`relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain ${bare ? '' : 'px-4 pb-4'} ${className}`}
    />
  );
}

// A section's heading in the list: its icon (optional), its name and its line.
/** A gallery category (Add Field, Add Widget): clear air and a hairline between categories so a long list reads as
 *  groups, not one wall of tiles. The first category sits close under the gallery's own header. */
export const GALLERY_SECTION_CLASS =
  'mt-7 border-t border-slate-100 pt-6 first:mt-0 first:border-t-0 first:pt-4 dark:border-slate-800';

export function GallerySectionHeading({
  id,
  icon,
  title,
  line,
}: {
  id: string;
  icon?: ReactNode;
  title: string;
  line: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
      <h4
        id={id}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800 dark:text-slate-100"
      >
        {icon ? (
          <span aria-hidden className="flex text-brand-700 [&_svg]:size-3.5 dark:text-brand-300">
            {icon}
          </span>
        ) : null}
        {title}
      </h4>
      {/* slate-500 on the white gallery is 4.8:1, slate-400 on its dark one 6.9:1 (WCAG AA 4.5:1). */}
      <span data-group-line className="text-[11px] text-slate-500 dark:text-slate-400">
        {line}
      </span>
    </div>
  );
}
