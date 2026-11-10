import {
  cleanPinLabel,
  isMapShape,
  MAP_HIGHLIGHTS_MAX,
  MAP_PINS_MAX,
  type Element,
  type MapViewChoice,
  type ShapeElement,
} from '@livedocuments/document';
import { track } from '@/lib/telemetry';
import { makeShapePatcher } from '@/hooks/canvas/shape-patcher';

// The map's writes (docs/specs/009-elements/map.md; blueprint "Setters"). Each is one commit, so one undo
// step: the Map dialog's Done, or the menu's View rows. The dialog's setter names its element rather than
// reading the selection: it edits the map it was opened for, whatever the selection does behind it.

export type MapPatch = Pick<ShapeElement, 'mapRegion' | 'mapCountry' | 'mapHighlights' | 'mapPins'>;

/** A dialog draft as stored: limits kept, duplicates and blank labels dropped, empty lists absent. */
export function cleanMapPatch(patch: MapPatch): MapPatch {
  const highlights = [...new Set(patch.mapHighlights ?? [])].slice(0, MAP_HIGHLIGHTS_MAX);
  const pins = (patch.mapPins ?? []).slice(0, MAP_PINS_MAX).map((p) => {
    const label = cleanPinLabel(p.label);
    return { id: p.id, lat: p.lat, lon: p.lon, ...(label ? { label } : {}) };
  });
  return {
    mapRegion: patch.mapRegion && patch.mapRegion !== 'world' ? patch.mapRegion : undefined,
    mapCountry: patch.mapCountry || undefined,
    mapHighlights: highlights.length ? highlights : undefined,
    mapPins: pins.length ? pins : undefined,
  };
}

export function useMapSetters({
  currentSelectionIds,
  commit,
}: {
  currentSelectionIds: () => Set<string>;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
}) {
  const patchSelected = makeShapePatcher({ currentSelectionIds, commit, matches: isMapShape });

  // The dialog's draft, onto the map it was opened for.
  const setMap = (id: string, patch: MapPatch) => {
    const clean = cleanMapPatch(patch);
    commit((els) =>
      els.map((el) =>
        el.id === id && el.type === 'shape' && isMapShape(el.shape) ? { ...el, ...clean } : el,
      ),
    );
    track('Element', 'Changed', 'Map');
  };

  // The menu's View: a region clears any country focus; a country keeps the region under it.
  const setMapViewSelected = (view: MapViewChoice) =>
    patchSelected(
      'country' in view
        ? { mapCountry: view.country }
        : { mapRegion: view.region === 'world' ? undefined : view.region, mapCountry: undefined },
      'Map',
    );

  return { setMap, setMapViewSelected };
}

export type MapSetters = ReturnType<typeof useMapSetters>;
