'use client';

// The type editor's Configuration tab (docs/specs/026-plan/item-types.md "Editing a type"): one scrolling panel of
// two sections under their own headings, General (the name with its glyph, and the colour) then Fields (the Fields
// and Tabs list). The editor owns the draft; this only lays it out.
import { useId, type ReactNode } from 'react';
import { ITEM_TYPE_LABEL_MAX } from '@livediagram/items';
import { SheetRow } from './PlanModal';
import { ColourSwatches } from './ColourSwatches';
import { GlyphPicker } from './GlyphPicker';
import { ItemTypeLayoutEditor } from './ItemTypeLayoutEditor';
import type { LayoutDraft } from './item-type-layout';

// A General row on desktop: two grid rows (label, control) shared with its neighbour through subgrid.
const GENERAL_CELL = 'md:row-span-2 md:mb-0 md:grid md:grid-rows-subgrid md:items-start';

export function ItemTypeConfiguration({
  nameId,
  isNew,
  label,
  onLabel,
  glyph,
  onGlyph,
  color,
  onColor,
  typeId,
  layout,
  onLayout,
  detailsLabel,
  onDetailsLabel,
  removedSome,
}: {
  // The Name input's id (its label points at it).
  nameId: string;
  // A new type: the caret starts in Name.
  isNew: boolean;
  label: string;
  onLabel: (next: string) => void;
  glyph: string;
  onGlyph: (next: string) => void;
  color: string;
  onColor: (next: string) => void;
  typeId: string | undefined;
  layout: LayoutDraft;
  onLayout: (next: LayoutDraft) => void;
  detailsLabel: string;
  onDetailsLabel: (next: string) => void;
  // A field the type had is gone from the draft (the layout editor says what that means).
  removedSome: boolean;
}) {
  return (
    <div className="flex flex-col">
      {/* General opens the panel, so it needs no visible heading: Name and Colour say what it is. Still named for
          assistive tech and the tour. */}
      <ConfigurationSection title="General" tourId="card-type-general" hideTitle>
        {/* On desktop, Name and Colour on one row: each row spans the grid's two rows (subgrid), so the labels share
            the first and the controls the second, top-aligned, the swatches centred on the name field's height. Stacked on a phone. */}
        <div className="md:mb-3 md:grid md:grid-cols-[minmax(0,20rem)_max-content] md:grid-rows-[auto_auto] md:items-start md:gap-x-6">
          <SheetRow label="Name" htmlFor={nameId} className={GENERAL_CELL}>
            {/* The glyph and the name as one field: pick the glyph at its start, type the name after it. */}
            <div className="flex max-w-xs items-center gap-1 rounded-lg border border-slate-200 bg-white pl-1 pr-2 transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900">
              <GlyphPicker value={glyph} colour={color} onChange={onGlyph} inline />
              <input
                id={nameId}
                value={label}
                maxLength={ITEM_TYPE_LABEL_MAX}
                placeholder="Customer call"
                autoFocus={isNew}
                onChange={(e) => onLabel(e.target.value)}
                className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
              />
            </div>
          </SheetRow>
          <SheetRow label="Colour" className={GENERAL_CELL}>
            {/* At least the name field's height (its h-9 input and 1 px border, 2.375rem), the swatches centred in it;
                the custom colour picker, opened in place, grows it downward and leaves the name field where it is. */}
            <div className="md:flex md:min-h-[2.375rem] md:flex-col md:justify-center">
              <ColourSwatches allowCustom value={color} onChange={(c) => c && onColor(c)} />
            </div>
          </SheetRow>
        </div>
      </ConfigurationSection>
      <ConfigurationSection
        title="Fields"
        tourId="card-type-fields"
        className="mt-2 border-t border-slate-100 pt-4 dark:border-slate-800"
      >
        <p className="mb-2 text-[12px] text-slate-500 dark:text-slate-400">
          Laid out as the card's panel shows them. Add, move or rename to change it.
        </p>
        <ItemTypeLayoutEditor
          typeId={typeId}
          draft={layout}
          onChange={onLayout}
          detailsLabel={detailsLabel}
          onDetailsLabel={onDetailsLabel}
          removedSome={removedSome}
        />
      </ConfigurationSection>
    </div>
  );
}

// A section of the panel, named by its heading; the tour points at it whole.
function ConfigurationSection({
  title,
  tourId,
  className = '',
  hideTitle = false,
  children,
}: {
  title: string;
  tourId: string;
  className?: string;
  // Kept for screen readers only.
  hideTitle?: boolean;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      data-tour-id={tourId}
      className={`scroll-mt-2 ${className}`}
    >
      <h3
        id={headingId}
        className={
          hideTitle ? 'sr-only' : 'mb-3 text-[13px] font-semibold text-slate-900 dark:text-slate-50'
        }
      >
        {title}
      </h3>
      {children}
    </section>
  );
}
