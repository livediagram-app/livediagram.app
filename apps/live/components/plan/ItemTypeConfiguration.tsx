'use client';

// The type editor's Configuration tab (docs/specs/026-plan/item-types.md "Editing a type"): one scrolling panel of
// two sections under their own headings, General (the name field, holding the glyph and the colour) then Fields (the Fields
// and Tabs list). The editor owns the draft; this only lays it out.
import { useId, type ReactNode } from 'react';
import { ITEM_TYPE_LABEL_MAX } from '@livediagram/items';
import { SheetRow } from './PlanModal';
import { TypeColourButton } from './ColourSwatches';
import { GlyphPicker } from './GlyphPicker';
import { ItemTypeLayoutEditor } from './ItemTypeLayoutEditor';
import type { LayoutDraft } from './item-type-layout';

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
      {/* General opens the panel, so it needs no visible heading: the Name field says what it is. Still named for
          assistive tech and the tour. */}
      <ConfigurationSection title="General" tourId="card-type-general" hideTitle>
        <SheetRow label="Name" htmlFor={nameId}>
          {/* One field: pick the glyph at its start, type the name after it, pick the colour at its end. */}
          <div className="flex max-w-xs items-center gap-1 rounded-lg border border-slate-200 bg-white px-1 transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900">
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
            <TypeColourButton value={color} onChange={onColor} />
          </div>
        </SheetRow>
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
