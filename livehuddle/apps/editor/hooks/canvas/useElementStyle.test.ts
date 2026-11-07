// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  createArrow,
  createShape,
  DEFAULT_ANIMATION_SPEED,
  type Element,
  type Tab,
} from '@livehuddle/document';
import { useElementStyle } from './useElementStyle';

// useElementStyle builds plain handler closures from its deps (no internal
// React hooks), so one render gives the handlers the tests drive. These tests pin the
// selection-wide setters to a MULTI-selection (selectedId null, two shapes in
// currentSelectionIds), guarding against the "applies to the single selection
// only" regression where a setter reads selectedId instead of the selection
// set.

function harness(elements: Element[], selection: Set<string>) {
  const tab: Tab = { id: 'tab1', name: 'Tab', elements };
  let committed = tab;
  const style = renderHook(() =>
    useElementStyle({
      currentSelectionIds: () => new Set(selection),
      selectionPrimary: () => elements.find((e) => selection.has(e.id)) ?? null,
      // multi-select: no single id
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set<string>() }),
      activeTab: committed,
      activeId: 'tab1',
      editsBlocked: false,
      commit: (map) => {
        committed = { ...committed, elements: map(committed.elements) };
      },
      tickTabs: (map) => {
        committed = map([committed])[0]!;
      },
      checkpointBurst: () => {},
    }),
  ).result.current;
  return { style, result: () => committed.elements, tab: () => committed };
}

describe('useElementStyle selection-wide setters on a multi-selection', () => {
  it('applies border stroke + style to every selected shape', () => {
    const a = createShape('square', 0, 0);
    const b = createShape('square', 200, 0);
    const { style, result } = harness([a, b], new Set([a.id, b.id]));

    style.setBorderStrokeSelected('thick');
    style.setBorderStyleSelected('dashed');

    for (const el of result()) {
      expect((el as { strokeWidth?: string }).strokeWidth).toBe('thick');
      expect((el as { strokeStyle?: string }).strokeStyle).toBe('dashed');
    }
  });

  it('applies stroke colour to every selected shape (parity with border)', () => {
    const a = createShape('square', 0, 0);
    const b = createShape('square', 200, 0);
    const { style, result } = harness([a, b], new Set([a.id, b.id]));

    style.setStrokeColorSelected('#123456');

    for (const el of result()) {
      expect((el as { strokeColor?: string }).strokeColor).toBe('#123456');
    }
  });
});

describe('useElementStyle Reset Aspect Ratio', () => {
  it('resets every shape of a multi-selection, one saved locked included', () => {
    const a = { ...createShape('square', 0, 0), width: 300, height: 100 };
    const b = { ...createShape('square', 400, 0), width: 100, height: 300 };
    const locked = { ...createShape('square', 800, 0), width: 300, height: 100, locked: true };
    const { style, result } = harness([a, b, locked], new Set([a.id, b.id, locked.id]));

    style.resetAspectRatioSelected();

    const [ra, rb, rl] = result() as (typeof a)[];
    expect(ra!.width).not.toBe(300);
    expect(rb!.height).not.toBe(300);
    expect(ra!.width / ra!.height).toBeCloseTo(rb!.width / rb!.height, 1);
    expect([rl!.width, rl!.height]).not.toEqual([300, 100]);
  });
});

describe('useElementStyle shape markers (docs/specs/009-elements/shape-markers.md)', () => {
  it('sets and clears a marker on the selected shape', () => {
    const a = createShape('square', 0, 0);
    const { style, result } = harness([a], new Set([a.id]));

    style.setMarkerSelected('green-circle');
    expect((result()[0] as { marker?: string }).marker).toBe('green-circle');

    style.setMarkerSelected(null);
    expect((result()[0] as { marker?: string }).marker).toBeUndefined();
  });

  it('sets the marker size bucket', () => {
    const a = createShape('square', 0, 0);
    const { style, result } = harness([a], new Set([a.id]));

    style.setMarkerSizeSelected('lg');
    expect((result()[0] as { markerSize?: string }).markerSize).toBe('lg');
  });
});

describe('useElementStyle shape style presets (docs/specs/010-palette/style-presets.md)', () => {
  it('applies a style preset (colour + matching border) in one step', () => {
    const a = createShape('square', 0, 0);
    const { style, result } = harness([a], new Set([a.id]));

    style.applyShapeColorPresetSelected({
      id: 'bold',
      name: 'Bold',
      fill: '#fee2e2',
      stroke: '#ef4444',
      text: '#7f1d1d',
      borderStroke: 'thick',
      borderStyle: 'solid',
    });

    const el = result()[0] as {
      fillColor?: string;
      strokeColor?: string;
      textColor?: string;
      strokeWidth?: string;
      strokeStyle?: string;
      borderRadius?: string;
      colorPreset?: string;
    };
    expect(el.fillColor).toBe('#fee2e2');
    expect(el.strokeColor).toBe('#ef4444');
    expect(el.textColor).toBe('#7f1d1d');
    // A preset is one complete look now: it stamps the border too (docs/specs/010-palette/style-presets.md).
    expect(el.strokeWidth).toBe('thick');
    expect(el.strokeStyle).toBe('solid');
    // Radius stays the user's own choice (docs/specs/010-palette/style-presets.md): presets never stamp it.
    expect(el.borderRadius).toBeUndefined();
    // The preset id is recorded so a theme change can re-derive it.
    expect(el.colorPreset).toBe('bold');
  });

  it('resets a preset-styled shape back to its defaults (colour + border cleared)', () => {
    const a = createShape('square', 0, 0);
    const { style, result } = harness([a], new Set([a.id]));

    style.applyShapeColorPresetSelected({
      id: 'bold',
      name: 'Bold',
      fill: '#fee2e2',
      stroke: '#ef4444',
      text: '#7f1d1d',
      borderStroke: 'thick',
      borderStyle: 'dotted',
    });
    style.resetShapeStyleSelected();

    const el = result()[0] as {
      strokeWidth?: string;
      strokeStyle?: string;
      borderRadius?: string;
      colorPreset?: string;
    };
    expect(el.strokeWidth).toBeUndefined();
    expect(el.strokeStyle).toBeUndefined();
    expect(el.borderRadius).toBeUndefined();
    // Reset also drops the colour-preset binding (docs/specs/010-palette/style-presets.md).
    expect(el.colorPreset).toBeUndefined();
  });

  it('clears the colour-preset binding when a colour is hand-edited', () => {
    const a = createShape('square', 0, 0);
    const { style, result } = harness([a], new Set([a.id]));

    style.applyShapeColorPresetSelected({
      id: 'bold',
      name: 'Bold',
      fill: '#fee2e2',
      stroke: '#ef4444',
      text: '#7f1d1d',
      borderStroke: 'thick',
      borderStyle: 'solid',
    });
    style.setFillColorSelected('#123456');

    const el = result()[0] as { fillColor?: string; colorPreset?: string };
    expect(el.fillColor).toBe('#123456');
    expect(el.colorPreset).toBeUndefined();
  });
});

describe('useElementStyle arrow style presets (docs/specs/010-palette/style-presets.md)', () => {
  it('applies an animated line preset (pattern + thickness + flow) in one step', () => {
    const a = createArrow(0, 0, 100, 0);
    const { style, result } = harness([a], new Set([a.id]));

    style.applyArrowPresetSelected({ style: 'dashed', thickness: 'thick', flow: 'dashes' });

    const el = result()[0] as {
      strokeStyle?: string;
      strokeWidth?: number;
      flow?: string;
      flowSpeed?: string;
    };
    expect(el.strokeStyle).toBe('dashed');
    expect(el.strokeWidth).toBe(4); // thick → 4px
    expect(el.flow).toBe('dashes');
    // A fresh flow starts at the shared default speed ('slow', docs/specs/008-canvas/canvas-and-palette.md).
    expect(el.flowSpeed).toBe(DEFAULT_ANIMATION_SPEED);
  });

  it('a preset without a flow clears any existing animation', () => {
    const a = createArrow(0, 0, 100, 0);
    const { style, result } = harness([a], new Set([a.id]));

    style.applyArrowPresetSelected({ style: 'solid', thickness: 'medium', flow: 'dashes' });
    style.applyArrowPresetSelected({ style: 'dotted', thickness: 'medium' });

    const el = result()[0] as { flow?: string; strokeStyle?: string };
    expect(el.flow).toBeUndefined();
    expect(el.strokeStyle).toBe('dotted');
  });

  it('resets a preset-styled arrow back to its defaults', () => {
    const a = createArrow(0, 0, 100, 0);
    const { style, result } = harness([a], new Set([a.id]));

    style.applyArrowPresetSelected({ style: 'dashed', thickness: 'thick', flow: 'dashes' });
    style.resetArrowStyleSelected();

    const el = result()[0] as {
      strokeStyle?: string;
      strokeWidth?: number;
      flow?: string;
      flowSpeed?: string;
    };
    expect(el.strokeStyle).toBeUndefined();
    expect(el.strokeWidth).toBeUndefined();
    expect(el.flow).toBeUndefined();
    expect(el.flowSpeed).toBeUndefined();
  });
});

describe('useElementStyle bring to front / send to back (docs/specs/006-document/layers.md "Stacking")', () => {
  it('moves the selection to the end of the array', () => {
    const a = createShape('square', 0, 0);
    const b = createShape('square', 200, 0);
    const { style, tab } = harness([a, b], new Set([a.id]));
    style.bringSelectedToFront();
    expect(tab().elements.map((e) => e.id)).toEqual([b.id, a.id]);
  });

  it('moves the selection to the start of the array', () => {
    const a = createShape('square', 0, 0);
    const b = createShape('square', 200, 0);
    const { style, tab } = harness([a, b], new Set([b.id]));
    style.sendSelectedToBack();
    expect(tab().elements.map((e) => e.id)).toEqual([b.id, a.id]);
  });
});
