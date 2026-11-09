'use client';

// The Map dialog (docs/specs/009-elements/map.md "The Map dialog"; blueprint "Edit"): a large live preview
// that a click edits (toggling a country, or dropping a pin), and beside it the View, the highlighted
// countries and the pins, each also reachable without the map (Add Country, Find a Place), so the
// preview is never the only way in. The dialog edits a draft; Done writes it as one undo step,
// Cancel or Escape leaves the map as it was.

import { useMemo, useState } from 'react';
import { Button, DialogCloseButton, DialogHeader, Select, Tooltip } from '@livedocuments/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { SegmentedRadio } from '@liveworkspace/workbench/components/primitives/SegmentedRadio';
import {
  cleanPinLabel,
  mapLandColour,
  mapPaperColour,
  MAP_HIGHLIGHTS_MAX,
  MAP_PIN_LABEL_MAX,
  MAP_PINS_MAX,
  MAP_REGION_LABELS,
  MAP_REGIONS,
  unprojectPoint,
  type MapGeometry,
  type MapPin,
  type MapRegion,
  type ShapeElement,
} from '@livedocuments/document';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { MapDrawing } from '@/components/canvas/MapDrawing';
import { useMapGeometry } from '@/lib/map-geometry-loader';
import { cleanMapPatch, type MapPatch } from '@/hooks/canvas/useMapSetters';
import { MapSearchField, matchCountries, matchPlaces } from '@/components/dialogs/MapSearchField';
import { MapPinRows } from '@/components/dialogs/MapPinRows';

type Mode = 'countries' | 'pins';
const MODES: readonly { id: Mode; label: string }[] = [
  { id: 'countries', label: 'Highlight Countries' },
  { id: 'pins', label: 'Place Pins' },
];
// The preview keeps the element's own proportions, inside these bounds (px, before CSS scaling).
const PREVIEW_W = 640;
const PREVIEW_MIN_H = 200;
const PREVIEW_MAX_H = 420;
// The preview is drawn on light paper in both appearances, as the Sankey's is, so one set of colours reads.
const PREVIEW_INK = '#0f172a';

const newPinId = () => `pin-${crypto.randomUUID().slice(0, 8)}`;

function sameDraft(a: MapPatch, b: MapPatch): boolean {
  return JSON.stringify(cleanMapPatch(a)) === JSON.stringify(cleanMapPatch(b));
}

export function MapDialog({
  element,
  accent,
  onCommit,
  onClose,
}: {
  element: ShapeElement;
  // The map's resolved accent, so the preview's highlights and pins are the canvas's.
  accent: string;
  onCommit: (patch: MapPatch) => void;
  onClose: () => void;
}) {
  const geometry = useMapGeometry();
  // What the map held when the dialog opened, so Done can tell whether anything changed.
  const [initial] = useState<MapPatch>(() => ({
    mapRegion: element.mapRegion,
    mapCountry: element.mapCountry,
    mapHighlights: element.mapHighlights,
    mapPins: element.mapPins,
  }));
  const [draft, setDraft] = useState<MapPatch>(initial);
  const [mode, setMode] = useState<Mode>('countries');
  const [hovered, setHovered] = useState<string | null>(null);
  const [focusPin, setFocusPin] = useState<string | null>(null);

  const highlights = draft.mapHighlights ?? [];
  const pins = draft.mapPins ?? [];
  const nameOf = useMemo(() => {
    const names = new Map((geometry?.countries ?? []).map((c) => [c[0], c[1]] as const));
    return (code: string) => names.get(code) ?? code;
  }, [geometry]);

  const toggleCountry = (code: string) =>
    setDraft((d) => {
      const list = d.mapHighlights ?? [];
      if (list.includes(code)) return { ...d, mapHighlights: list.filter((c) => c !== code) };
      if (list.length >= MAP_HIGHLIGHTS_MAX) return d;
      return { ...d, mapHighlights: [...list, code] };
    });
  const addPin = (pin: Omit<MapPin, 'id'>) => {
    if (pins.length >= MAP_PINS_MAX) return;
    const id = newPinId();
    setDraft((d) => ({ ...d, mapPins: [...(d.mapPins ?? []), { id, ...pin }] }));
    return id;
  };
  const setPins = (next: MapPin[]) => setDraft((d) => ({ ...d, mapPins: next }));

  const done = () => {
    if (!sameDraft(draft, initial)) onCommit(draft);
    onClose();
  };

  // The preview's proportions follow the element's.
  const previewH = Math.round(
    Math.max(
      PREVIEW_MIN_H,
      Math.min(PREVIEW_MAX_H, (PREVIEW_W * element.height) / Math.max(1, element.width)),
    ),
  );
  const colours = useMemo(
    () => ({
      land: mapLandColour(element.fillColor, 'light'),
      accent,
      paper: mapPaperColour('light'),
      text: PREVIEW_INK,
    }),
    [element.fillColor, accent],
  );
  const viewValue = draft.mapCountry ? `country:${draft.mapCountry}` : (draft.mapRegion ?? 'world');
  const regionLabel = draft.mapCountry
    ? nameOf(draft.mapCountry)
    : MAP_REGION_LABELS[draft.mapRegion ?? 'world'];
  const readout =
    hovered !== null
      ? nameOf(hovered)
      : mode === 'countries'
        ? 'Click a country to highlight it, or again to clear it.'
        : 'Click the map to drop a pin there.';

  return (
    <Dialog open onClose={onClose} ariaLabel="Edit map" size="3xl" className="max-h-[92vh]">
      <DialogHeader
        title="Edit Map"
        subtitle="Choose what it shows, pick out countries and pin places."
      >
        <HelpArticleLink article="maps" variant="labelled" />
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-6 py-4 sm:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0">
          <SegmentedRadio
            label="A click on the map"
            options={MODES}
            value={mode}
            onChange={setMode}
            className="mb-3 max-w-sm"
          />
          <figure>
            <div
              role="img"
              aria-label={`Map of ${regionLabel}: ${highlights.length} highlighted, ${pins.length} pinned`}
              className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700"
              style={{ aspectRatio: `${PREVIEW_W} / ${previewH}` }}
            >
              <MapPreview
                draft={draft}
                height={previewH}
                geometry={geometry}
                colours={colours}
                mode={mode}
                onCountryPress={toggleCountry}
                onHover={setHovered}
                onPlace={(x, y) => {
                  const at = unprojectPoint(x, y);
                  const id = addPin({
                    lat: Math.round(at.lat * 100) / 100,
                    lon: Math.round(at.lon * 100) / 100,
                  });
                  if (id) setFocusPin(id);
                }}
              />
            </div>
            <figcaption
              aria-live="polite"
              className="mt-1.5 min-h-[1.25rem] text-[12px] text-slate-500 dark:text-slate-400"
            >
              {readout}
            </figcaption>
          </figure>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <section>
            <h3 className="mb-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
              View
            </h3>
            <Select
              aria-label="View"
              className="w-full"
              selectClassName="text-[13px]"
              value={viewValue}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((d) =>
                  v.startsWith('country:')
                    ? { ...d, mapCountry: v.slice(8) }
                    : { ...d, mapRegion: v as MapRegion, mapCountry: undefined },
                );
              }}
            >
              <optgroup label="Regions">
                {MAP_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {MAP_REGION_LABELS[r]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="One Country">
                {(geometry?.countries ?? []).map((c) => (
                  <option key={c[0]} value={`country:${c[0]}`}>
                    {c[1]}
                  </option>
                ))}
              </optgroup>
            </Select>
          </section>

          <section>
            <h3 className="mb-1.5 flex items-baseline justify-between text-[12px] font-semibold text-slate-700 dark:text-slate-200">
              Countries
              <span className="font-normal text-slate-500 dark:text-slate-400">
                {highlights.length} of {MAP_HIGHLIGHTS_MAX}
              </span>
            </h3>
            {highlights.length ? (
              <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Highlighted countries">
                {highlights.map((code) => (
                  <li key={code}>
                    <Tooltip label={`Remove ${nameOf(code)}`}>
                      <button
                        type="button"
                        aria-label={`Remove ${nameOf(code)}`}
                        onClick={() => toggleCountry(code)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white py-0.5 pl-2 pr-1.5 text-[12px] text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <span
                          aria-hidden
                          className="h-2 w-2 rounded-full"
                          style={{ background: accent }}
                        />
                        {nameOf(code)}
                        <span aria-hidden className="text-slate-400">
                          ×
                        </span>
                      </button>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            ) : null}
            <MapSearchField
              label="Add Country"
              placeholder="Add a country…"
              disabled={highlights.length >= MAP_HIGHLIGHTS_MAX}
              search={(q) =>
                matchCountries(geometry, q)
                  .filter((c) => !highlights.includes(c.id))
                  .slice(0, 6)
              }
              onPick={(id) => toggleCountry(id)}
            />
          </section>

          <section>
            <h3 className="mb-1.5 flex items-baseline justify-between text-[12px] font-semibold text-slate-700 dark:text-slate-200">
              Pins
              <span className="font-normal text-slate-500 dark:text-slate-400">
                {pins.length} of {MAP_PINS_MAX}
              </span>
            </h3>
            <MapSearchField
              label="Find a Place"
              placeholder="Find a city…"
              disabled={pins.length >= MAP_PINS_MAX}
              search={(q) => matchPlaces(geometry, q, nameOf).slice(0, 6)}
              onPick={(_, row) => {
                if (row.lat === undefined || row.lon === undefined) return;
                addPin({ lat: row.lat, lon: row.lon, label: cleanPinLabel(row.label) });
              }}
            />
            <MapPinRows
              pins={pins}
              labelMax={MAP_PIN_LABEL_MAX}
              focusId={focusPin}
              onChange={setPins}
            />
          </section>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
        <Button variant="secondary" size="md" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="md" onClick={done}>
          Done
        </Button>
      </div>
    </Dialog>
  );
}

// The preview's drawing, its handlers chosen by the mode.
function MapPreview({
  draft,
  height,
  geometry,
  colours,
  mode,
  onCountryPress,
  onHover,
  onPlace,
}: {
  draft: MapPatch;
  height: number;
  geometry: MapGeometry | null;
  colours: { land: string; accent: string; paper: string; text: string };
  mode: Mode;
  onCountryPress: (code: string) => void;
  onHover: (code: string | null) => void;
  onPlace: (x: number, y: number) => void;
}) {
  return (
    <MapDrawing
      fields={draft}
      width={PREVIEW_W}
      height={height}
      geometry={geometry}
      colours={colours}
      className="absolute inset-0 block h-full w-full"
      cursor={mode === 'countries' ? 'pointer' : 'crosshair'}
      onCountryHover={onHover}
      onCountryPress={mode === 'countries' ? onCountryPress : undefined}
      onPress={mode === 'pins' ? onPlace : undefined}
    />
  );
}
