import { describe, it, expect } from 'vitest';
import { createArrow, createShape, type Element, type Tab } from '@livediagram/diagram';
import { useElementStyle } from './useElementStyle';

// useElementStyle builds plain handler closures from its deps (no internal
// React hooks), so it can be exercised directly. These tests pin the
// selection-wide setters to a MULTI-selection (selectedId null, two shapes in
// currentSelectionIds), guarding against the "applies to the single selection
// only" regression where a setter reads selectedId instead of the selection
// set.

function harness(elements: Element[], selection: Set<string>) {
  const tab: Tab = { id: 'tab1', name: 'Tab', elements };
  let committed = elements;
  // useElementStyle builds plain closures from its deps (no internal React
  // hooks), so calling it outside a component is safe here.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const style = useElementStyle({
    currentSelectionIds: () => new Set(selection),
    selectionPrimary: () => elements.find((e) => selection.has(e.id)) ?? null,
    selectedId: null, // multi-select: no single id
    activeTab: { ...tab, elements: committed },
    activeId: 'tab1',
    editsBlocked: false,
    commit: (map) => {
      committed = map(committed);
    },
    commitTabs: (map) => {
      committed = map([{ ...tab, elements: committed }])[0]!.elements;
    },
    scheduleElementChangeLog: () => {},
  });
  return { style, result: () => committed };
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

describe('useElementStyle shape markers (spec/49)', () => {
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

describe('useElementStyle timeline rail (spec/51)', () => {
  it('sets the point count and resizes to keep spacing constant', () => {
    const a = createShape('timeline-rail', 0, 0);
    const { style, result } = harness([a], new Set([a.id]));

    style.setRailCountSelected(5);
    const el = result()[0] as { railCount?: number; width: number };
    expect(el.railCount).toBe(5);
    expect(el.width).toBe(5 * 120); // RAIL_POINT_STEP_PX
  });

  it('clamps the count to the allowed range', () => {
    const a = createShape('timeline-rail', 0, 0);
    const { style, result } = harness([a], new Set([a.id]));
    style.setRailCountSelected(99);
    expect((result()[0] as { railCount?: number }).railCount).toBe(12); // RAIL_MAX_POINTS
  });

  it('appends a point via addRailPointSelected', () => {
    const a = createShape('timeline-rail', 0, 0); // default 3
    const { style, result } = harness([a], new Set([a.id]));
    style.addRailPointSelected();
    const el = result()[0] as { railCount?: number; width: number };
    expect(el.railCount).toBe(4);
    expect(el.width).toBe(4 * 120);
  });

  it('leaves non-rail shapes untouched', () => {
    const a = createShape('square', 0, 0);
    const { style, result } = harness([a], new Set([a.id]));
    style.setRailCountSelected(5);
    expect((result()[0] as { railCount?: number }).railCount).toBeUndefined();
  });
});

describe('useElementStyle rating (spec/52)', () => {
  it('sets the star score (clamped 0..5) on the rating shape', () => {
    const a = createShape('rating', 0, 0);
    const { style, result } = harness([a], new Set([a.id]));
    style.setRatingSelected(4);
    expect((result()[0] as { rating?: number }).rating).toBe(4);
    style.setRatingSelected(99);
    expect((result()[0] as { rating?: number }).rating).toBe(5);
  });

  it('sets and clears the rating animation', () => {
    const a = createShape('rating', 0, 0);
    const { style, result } = harness([a], new Set([a.id]));
    style.setRatingAnimSelected('twinkle');
    expect((result()[0] as { ratingAnim?: string }).ratingAnim).toBe('twinkle');
    style.setRatingAnimSelected(null);
    expect((result()[0] as { ratingAnim?: string }).ratingAnim).toBeUndefined();
  });

  it('leaves non-rating shapes untouched', () => {
    const a = createShape('square', 0, 0);
    const { style, result } = harness([a], new Set([a.id]));
    style.setRatingSelected(4);
    expect((result()[0] as { rating?: number }).rating).toBeUndefined();
  });
});

describe('useElementStyle shape style presets (spec/48)', () => {
  it('applies a colour preset (fill + stroke + text) in one step, untouched border', () => {
    const a = createShape('square', 0, 0);
    const { style, result } = harness([a], new Set([a.id]));

    style.applyShapeColorPresetSelected({ fill: '#fee2e2', stroke: '#ef4444', text: '#7f1d1d' });

    const el = result()[0] as {
      fillColor?: string;
      strokeColor?: string;
      textColor?: string;
      strokeStyle?: string;
    };
    expect(el.fillColor).toBe('#fee2e2');
    expect(el.strokeColor).toBe('#ef4444');
    expect(el.textColor).toBe('#7f1d1d');
    // Border fields are independent of the colour preset.
    expect(el.strokeStyle).toBeUndefined();
  });

  it('applies a border preset (weight + pattern + radius), untouched colour', () => {
    const a = createShape('square', 0, 0);
    const { style, result } = harness([a], new Set([a.id]));

    style.applyShapeBorderPresetSelected({ stroke: 'thick', style: 'dotted', radius: 'lg' });

    const el = result()[0] as {
      strokeWidth?: string;
      strokeStyle?: string;
      borderRadius?: string;
      fillColor?: string;
    };
    expect(el.strokeWidth).toBe('thick');
    expect(el.strokeStyle).toBe('dotted');
    expect(el.borderRadius).toBe('lg');
    expect(el.fillColor).toBeUndefined();
  });

  it('resets a preset-styled shape back to its defaults (border cleared)', () => {
    const a = createShape('square', 0, 0);
    const { style, result } = harness([a], new Set([a.id]));

    style.applyShapeColorPresetSelected({ fill: '#fee2e2', stroke: '#ef4444', text: '#7f1d1d' });
    style.applyShapeBorderPresetSelected({ stroke: 'thick', style: 'dotted', radius: 'lg' });
    style.resetShapeStyleSelected();

    const el = result()[0] as {
      strokeWidth?: string;
      strokeStyle?: string;
      borderRadius?: string;
    };
    expect(el.strokeWidth).toBeUndefined();
    expect(el.strokeStyle).toBeUndefined();
    expect(el.borderRadius).toBeUndefined();
  });
});

describe('useElementStyle arrow style presets (spec/48)', () => {
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
    expect(el.flowSpeed).toBe('normal');
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
