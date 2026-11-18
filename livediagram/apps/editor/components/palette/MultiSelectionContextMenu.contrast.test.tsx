// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createShape, createText, type Element } from '@livediagram/document';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { MultiSelectionContextMenu } from './MultiSelectionContextMenu';
import type { EditorContextMenuProps } from './EditorContextMenu.types';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(cleanup);
// The menu observes its own size; jsdom has no ResizeObserver.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

// docs/specs/004-interface-design/colour-picker.md "Reading on its ground", "Several grounds": the
// multi-selection menu's Text row judges the colour on every selected text's own ground, the worst counting.
const rect = { x: 0, y: 0 };
// A mid grey: 4.5:1 on the paper canvas (reads), 4.2:1 on the cream box (short of 4.5).
const GREY = '#737373';
const text = (id: string, x: number, y: number) =>
  ({
    ...createText(rect.x + x, rect.y + y),
    id,
    width: 120,
    height: 30,
    label: 'Hi',
    textColor: GREY,
  }) as Element;
const cream = {
  ...createShape('square', rect.x + 20, rect.y + 20),
  id: 'cream',
  width: 200,
  height: 120,
  fillColor: '#fef3c7',
} as Element;
const onCream = text('on-cream', 40, 60);
const onPage = text('on-page', 40, 400);
const activeTab = { elements: [cream, onCream, onPage] };

function openTextRow(selection: Element[]) {
  render(
    <EditorContext.Provider value={{ activeTab, componentActions: { canEdit: false } } as never}>
      <MultiSelectionContextMenu
        props={
          {
            selectionElements: selection,
            colourPalette: { presets: [] },
          } as unknown as EditorContextMenuProps
        }
        position={{ x: 0, y: 0 }}
        onClose={vi.fn()}
        anchorBottom={false}
      />
    </EditorContext.Provider>,
  );
  fireEvent.click(screen.getByRole('button', { name: /Colours/ }));
  // The Colours section's Text row, not the Text section heading.
  const row = screen
    .getAllByRole('button', { name: /^Text/ })
    .find((b) => !b.hasAttribute('data-menu-section'))!;
  fireEvent.click(row);
}
const hint = () => screen.getByTestId('contrast-hint');

describe('the multi-selection Text row', () => {
  it('judges every selected text on its own ground and says how many fall short', () => {
    openTextRow([onCream, onPage]);
    expect(hint().textContent).toContain('Hard to read for 1 of 2');
    expect(hint().textContent).toContain('Worst 4.2:1, aim for 4.5:1');
    expect(
      screen.getByRole('button', { name: /^Use #[0-9a-f]{6}, .* reads on all 2$/ }),
    ).toBeTruthy();
  });

  it('says the colour reads for all of them when every ground passes', () => {
    openTextRow([onPage, { ...onPage, id: 'on-page-2' }]);
    expect(hint().childElementCount).toBe(0);
    expect(document.querySelector('[data-contrast-reads]')!.textContent).toContain(
      'Easy to read for all 2',
    );
  });
});
