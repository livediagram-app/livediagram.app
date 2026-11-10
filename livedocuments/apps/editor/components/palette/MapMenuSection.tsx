'use client';

// The map's menu (docs/specs/009-elements/map.md "The menu"): one Map category in the Tools flyout. Its top
// says what the map holds and opens the Map dialog; its View section picks a region, one undo step each.
// Choosing a single country lives in the dialog, where its list can be searched.

import type { ComponentProps } from 'react';
import { Button, lucideGlyph } from '@livedocuments/ui';
import {
  MAP_REGION_LABELS,
  MAP_REGIONS,
  type MapRegion,
  type MapViewChoice,
  type ShapeElement,
} from '@livedocuments/document';
import { lucideGlobe, lucideMap } from '@liveworkspace/icons/lucide';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { OptionRows } from '@liveworkspace/workbench/components/primitives/OptionRows';
import { MenuFlyoutSection } from '@liveworkspace/workbench/components/primitives/MenuFlyoutSection';
import { MENU_ICON_PX } from '@liveworkspace/workbench/components/palette/context-menu-icons';

const MapGlyph = lucideGlyph(lucideMap, MENU_ICON_PX);
const ViewGlyph = lucideGlyph(lucideGlobe, MENU_ICON_PX);

export type MapMenuHandlers = {
  onEditMap: (elementId: string) => void;
  onSetView: (view: MapViewChoice) => void;
};

type SectionProps = { open: boolean; onToggle: () => void; flush?: boolean };

/** What the menu's top line says: the view, then the counts. */
export function mapSummary(
  el: Pick<ShapeElement, 'mapRegion' | 'mapCountry' | 'mapHighlights' | 'mapPins'>,
): string {
  const view = el.mapCountry
    ? `Focused on ${el.mapCountry}`
    : MAP_REGION_LABELS[el.mapRegion ?? 'world'];
  const h = el.mapHighlights?.length ?? 0;
  const p = el.mapPins?.length ?? 0;
  return [
    view,
    `${h} ${h === 1 ? 'country' : 'countries'}`,
    `${p} ${p === 1 ? 'pin' : 'pins'}`,
  ].join(' · ');
}

export function MapMenuSections({
  target,
  handlers: h,
  sectionProps,
  flyoutProps,
}: {
  target: ShapeElement;
  handlers: MapMenuHandlers;
  sectionProps: (id: string) => SectionProps;
  flyoutProps: Omit<ComponentProps<typeof MenuFlyoutSection>, 'title' | 'icon' | 'children'>;
}) {
  return (
    <MenuFlyoutSection title="Map" icon={<MapGlyph />} {...flyoutProps}>
      <div className="px-3 py-2">
        <p className="text-[11px] text-slate-600 dark:text-slate-300">{mapSummary(target)}</p>
        <Button
          variant="secondary"
          size="xs"
          className="mt-1.5 w-full"
          title="Choose countries to highlight and places to pin"
          onClick={() => h.onEditMap(target.id)}
        >
          Edit Map
        </Button>
      </div>
      <MenuAccordionSection title="View" icon={<ViewGlyph />} {...sectionProps('map-view')}>
        <OptionRows
          kind="single"
          label="View"
          className="mx-3 mt-1"
          selected={target.mapCountry ? null : (target.mapRegion ?? 'world')}
          rows={MAP_REGIONS.map((r) => ({ id: r, label: MAP_REGION_LABELS[r] }))}
          onPick={(id) => h.onSetView({ region: id as MapRegion })}
        />
      </MenuAccordionSection>
    </MenuFlyoutSection>
  );
}
