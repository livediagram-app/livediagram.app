// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createShape, provideMapGeometry, type ShapeElement } from '@livedocuments/document';
import { MAP_GEOMETRY } from '@livedocuments/document/map-geometry';
import { MapDialog } from './MapDialog';
import { cleanMapPatch, type MapPatch } from '@/hooks/canvas/useMapSetters';

// docs/specs/009-elements/map.md "The Map dialog": a draft the preview and the side panel edit; Done writes it
// once, Cancel never.

beforeAll(() => provideMapGeometry(MAP_GEOMETRY));

const open = (over: Partial<ShapeElement> = {}) => {
  const onCommit = vi.fn<(patch: MapPatch) => void>();
  const onClose = vi.fn();
  const element = { ...createShape('map', 0, 0), id: 'm', ...over } as ShapeElement;
  const view = render(
    <MapDialog element={element} accent="#3b82f6" onCommit={onCommit} onClose={onClose} />,
  );
  return { onCommit, onClose, view };
};

describe('MapDialog', () => {
  it('toggles a country from the preview and commits once on Done', () => {
    const { onCommit, onClose } = open();
    const fr = document.querySelector('[data-map-country="FR"]')!;
    fireEvent.pointerDown(fr);
    expect(screen.getByRole('button', { name: 'Remove France' })).toBeTruthy();
    fireEvent.pointerDown(fr);
    expect(screen.queryByRole('button', { name: 'Remove France' })).toBeNull();
    fireEvent.pointerDown(document.querySelector('[data-map-country="JP"]')!);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]![0].mapHighlights).toEqual(['JP']);
    expect(onClose).toHaveBeenCalled();
  });

  it('adds a country by name or code from Add Country', () => {
    open();
    const field = screen.getByRole('combobox', { name: 'Add Country' });
    fireEvent.change(field, { target: { value: 'de' } });
    expect(within(screen.getByRole('listbox')).getAllByRole('option')[0]!.textContent).toBe(
      'Germany',
    );
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Remove Germany' })).toBeTruthy();
  });

  it('pins a place found by name, and names a pin dropped on the preview', () => {
    const { onCommit } = open();
    fireEvent.click(screen.getByRole('radio', { name: 'Place Pins' }));
    const field = screen.getByRole('combobox', { name: 'Find a Place' });
    fireEvent.change(field, { target: { value: 'Tokyo' } });
    fireEvent.pointerDown(screen.getByRole('option', { name: /Tokyo/ }));
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Pin 1 label' }).value).toBe(
      'Tokyo',
    );
    const svg = document.querySelector<SVGSVGElement>('svg[style*="crosshair"]')!;
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 640, height: 347, right: 640, bottom: 347 }) as DOMRect;
    act(() => {
      fireEvent.pointerDown(svg, { clientX: 320, clientY: 170 });
    });
    const second = screen.getByRole('textbox', { name: 'Pin 2 label' });
    expect(document.activeElement).toBe(second);
    fireEvent.change(second, { target: { value: 'Somewhere' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    const pins = onCommit.mock.calls[0]![0].mapPins!;
    expect(pins).toHaveLength(2);
    expect(pins[1]!.label).toBe('Somewhere');
    expect(Math.abs(pins[1]!.lat)).toBeLessThanOrEqual(85);
  });

  it('commits nothing on Cancel, or on Done with no change', () => {
    const first = open({ mapHighlights: ['FR'] });
    fireEvent.pointerDown(document.querySelector('[data-map-country="ES"]')!);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(first.onCommit).not.toHaveBeenCalled();
    first.view.unmount();
    const second = open({ mapHighlights: ['FR'] });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(second.onCommit).not.toHaveBeenCalled();
    expect(second.onClose).toHaveBeenCalled();
  });

  it('frames one country from View', () => {
    const { onCommit } = open();
    fireEvent.change(screen.getByRole('combobox', { name: 'View' }), {
      target: { value: 'country:BR' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onCommit.mock.calls[0]![0].mapCountry).toBe('BR');
  });
});

describe('cleanMapPatch', () => {
  it('drops the defaults, duplicates and blank labels, and keeps the limits', () => {
    expect(
      cleanMapPatch({
        mapRegion: 'world',
        mapCountry: '',
        mapHighlights: ['FR', 'FR', ...Array.from({ length: 70 }, (_, i) => `X${i}`)],
        mapPins: [{ id: 'a', lat: 1, lon: 2, label: '   ' }],
      }),
    ).toEqual({
      mapRegion: undefined,
      mapCountry: undefined,
      mapHighlights: expect.arrayContaining(['FR']),
      mapPins: [{ id: 'a', lat: 1, lon: 2 }],
    });
    expect(cleanMapPatch({ mapHighlights: ['FR', 'FR'] }).mapHighlights).toEqual(['FR']);
    expect(cleanMapPatch({ mapHighlights: [], mapPins: [] })).toEqual({
      mapRegion: undefined,
      mapCountry: undefined,
      mapHighlights: undefined,
      mapPins: undefined,
    });
    expect(
      cleanMapPatch({ mapHighlights: Array.from({ length: 70 }, (_, i) => `A${i}`) }).mapHighlights,
    ).toHaveLength(60);
  });
});
