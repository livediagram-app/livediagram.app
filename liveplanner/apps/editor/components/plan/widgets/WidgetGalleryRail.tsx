'use client';

// The widget gallery's rail (docs/specs/026-plan/board-widgets.md "The rail"), on the galleries' shared rail
// (GalleryRail): its sections down the left, each with how many widgets it holds, For You and the built-in groups
// first, then the card types' fields under a Fields heading. Pressing one scrolls its section into view; the section
// in view is marked current.
import { BoardWidgetArt, FieldWidgetArt, SparkArt } from '../plan-tile-art';
import { PlanTypeGlyph } from '../plan-type-glyph';
import { ACCENT_TEXT, accentVars } from '../plan-palette';
import { GalleryRail, type RailEntry } from '../gallery/GalleryRail';
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
  const entries = (rail: GallerySection['rail']): RailEntry[] =>
    sections
      .filter((s) => s.rail === rail)
      .map((s) => ({
        key: s.key,
        title: s.title,
        icon: <RailIcon icon={s.icon} />,
        count: sectionSize(s),
      }));
  return (
    <GalleryRail
      label="Widget sections"
      groups={[{ entries: entries('top') }, { heading: 'Fields', entries: entries('fields') }]}
      current={current}
      onPick={onPick}
    />
  );
}
