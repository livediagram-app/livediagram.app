import { describe, it, expect } from 'vitest';
import { createShape, type Element, type Tab } from '@livediagram/diagram';
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
