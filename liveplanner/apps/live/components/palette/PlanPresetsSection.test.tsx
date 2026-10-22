// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { planPresetColours, type ShapeElement } from '@liveplanner/project';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';
import { isPlanPresetShape, PlanPresetsSection } from './PresetSections';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

// docs/specs/010-palette/style-presets.md "Boards and sheets": a board's and a sheet's presets are calm hues, their
// tiles drawn for the surface they will be seen on.
const board = {
  id: 'b',
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 0,
  width: 400,
  height: 300,
} as unknown as ShapeElement;

function renderSection(surface: 'light' | 'dark') {
  const onApply = vi.fn();
  const props = {
    onApplyShapeColorPreset: onApply,
    onPreviewShapeColorPreset: vi.fn(),
    onPreviewStyleEnd: vi.fn(),
    onResetShapeStyle: vi.fn(),
  } as unknown as EditorContextMenuProps;
  render(
    <CanvasSurfaceProvider surface={surface}>
      <PlanPresetsSection
        target={board}
        props={props}
        accordion={{ open: true, onToggle: () => {}, flush: false }}
        onClose={() => {}}
      />
    </CanvasSurfaceProvider>,
  );
  return onApply;
}

describe('PlanPresetsSection', () => {
  it('is for boards and sheets only', () => {
    expect(isPlanPresetShape('plan-board')).toBe(true);
    expect(isPlanPresetShape('plan-sheet')).toBe(true);
    expect(isPlanPresetShape('square')).toBe(false);
  });

  it.each(['light', 'dark'] as const)(
    'applies a hue as its preset id on a %s canvas',
    (surface) => {
      const onApply = renderSection(surface);
      fireEvent.click(screen.getByRole('button', { name: /Sky/ }));
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'plan-sky',
          fill: planPresetColours('plan-sky', surface)!.fill,
        }),
      );
    },
  );
});
