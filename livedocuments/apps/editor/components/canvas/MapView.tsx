'use client';

// The map on the canvas (docs/specs/009-elements/map.md), a lazy chunk of its own (ShapeContentRouter):
// the land in the element's fill or the paper's soft default, highlighted countries and pins in its
// accent, labels in its text colour and face. The geometry loads on first draw; until then the
// placeholder shows.

import { useMemo } from 'react';
import {
  mapLandColour,
  mapPaperColour,
  type MapFields,
  type ShapeElement,
} from '@livedocuments/document';
import { useMapGeometry } from '@/lib/map-geometry-loader';
import { useElementSurface } from '@/components/canvas/CanvasSurfaceContext';
import { MapDrawing } from '@/components/canvas/MapDrawing';

export function MapView({
  element,
  accent,
  textColor,
  fontFamily,
}: {
  element: ShapeElement;
  accent: string;
  textColor: string;
  fontFamily?: string;
}) {
  const geometry = useMapGeometry();
  const surface = useElementSurface(element.id);
  const colours = useMemo(
    () => ({
      land: mapLandColour(element.fillColor, surface),
      accent,
      paper: mapPaperColour(surface),
      text: textColor,
    }),
    [element.fillColor, surface, accent, textColor],
  );
  const { mapRegion, mapCountry, mapHighlights, mapPins } = element;
  const fields: MapFields = useMemo(
    () => ({ mapRegion, mapCountry, mapHighlights, mapPins }),
    [mapRegion, mapCountry, mapHighlights, mapPins],
  );
  return (
    <MapDrawing
      fields={fields}
      width={element.width}
      height={element.height}
      geometry={geometry}
      colours={colours}
      fontFamily={fontFamily}
    />
  );
}
