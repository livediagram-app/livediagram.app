'use client';

// The widget gallery's rail (docs/specs/026-plan/board-widgets.md "The rail"): its sections down the left, each with how
// many widgets it holds, For You and the built-in groups first, then the card types' fields under a Fields heading.
// Pressing one scrolls its section into view; the section in view is marked current. In a narrow gallery the rail is
// a row of chips over the list (the container query on the gallery's box).
import { CountBadge } from '@liveplanner/ui';
import { BoardWidgetArt, FieldWidgetArt, SparkArt } from '../plan-tile-art';
import { PlanTypeGlyph } from '../plan-type-glyph';
import { ACCENT_TEXT, accentVars } from '../plan-palette';
import { sectionSize, type GalleryIcon, type GallerySection } from './widget-gallery-model';

function RailIcon({ icon }: { icon: GalleryIcon }) {
  switch (icon.kind) {
    case 'spark':
      return <SparkArt size={14} />;
    case 'widget':
      return <BoardWidgetArt kind={icon.widget} size={14} />;
    case 'type':
      // In its own colour, lifted in dark mode so Project's black still shows.
      return (
        <span className={`flex ${ACCENT_TEXT}`} style={accentVars(icon.type.color)}>
          <PlanTypeGlyph glyph={icon.type.glyph} size={14} />
        </span>
      );
    case 'fields':
      return <FieldWidgetArt view="breakdown" size={14} />;
  }
}

export function WidgetGalleryRail({
  sections,
  current,
  onPick,
}: {
  sections: readonly GallerySection[];
  current: string | null;
  onPick: (key: string) => void;
}) {
  const entry = (s: GallerySection) => {
    const size = sectionSize(s);
    const on = s.key === current;
    return (
      <li key={s.key} className="shrink-0">
        <button
          type="button"
          aria-current={on ? 'true' : undefined}
          data-rail-entry={s.key}
          onClick={() => onPick(s.key)}
          className={`flex w-full cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition @max-[600px]:rounded-full @max-[600px]:border @max-[600px]:py-1 ${
            on
              ? 'bg-brand-50 text-brand-800 @max-[600px]:border-brand-300 dark:bg-brand-500/15 dark:text-brand-100 dark:@max-[600px]:border-brand-500/50'
              : `text-slate-600 hover:bg-slate-100 @max-[600px]:border-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 dark:@max-[600px]:border-slate-700 ${
                  size === 0 ? 'opacity-55' : ''
                }`
          }`}
        >
          <span
            aria-hidden
            className={`flex shrink-0 ${on ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400'}`}
          >
            <RailIcon icon={s.icon} />
          </span>
          <span className="min-w-0 flex-1 truncate">{s.title}</span>
          {size > 0 ? <CountBadge count={size} /> : null}
        </button>
      </li>
    );
  };
  const top = sections.filter((s) => s.rail === 'top');
  const fields = sections.filter((s) => s.rail === 'fields');
  return (
    <nav
      aria-label="Widget sections"
      className="flex shrink-0 flex-col gap-0.5 overflow-y-auto overscroll-contain border-r border-slate-100 p-2 dark:border-slate-800 @max-[600px]:flex-row @max-[600px]:overflow-x-auto @max-[600px]:overflow-y-hidden @max-[600px]:border-b @max-[600px]:border-r-0 @max-[600px]:px-3 @min-[601px]:w-48 [scrollbar-width:thin]"
    >
      <ul className="flex flex-col gap-0.5 @max-[600px]:flex-row @max-[600px]:gap-1.5">
        {top.map(entry)}
      </ul>
      {fields.length > 0 ? (
        <>
          <h4 className="mt-3 px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 @max-[600px]:sr-only">
            Fields
          </h4>
          <ul className="flex flex-col gap-0.5 @max-[600px]:ml-1.5 @max-[600px]:flex-row @max-[600px]:gap-1.5">
            {fields.map(entry)}
          </ul>
        </>
      ) : null}
    </nav>
  );
}
