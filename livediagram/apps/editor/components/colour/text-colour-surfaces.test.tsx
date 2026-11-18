// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  contrastRatio,
  createTable,
  createText,
  type BoxedElement,
  type Element,
  type TableElement,
} from '@livediagram/document';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { QuickMoreColours } from '@/components/canvas/QuickMoreColours';
import { RichTextToolbar } from '@/components/canvas/RichTextToolbar';
import { TableCellMenu } from '@/components/canvas/TableCellMenu';
import { CanvasSurfaceProvider } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { standardGroup } from './colour-options';

// docs/specs/004-interface-design/colour-picker.md "Reading on its ground": every picker that colours
// text judges it, the Quick Style bar's Text colour More colours, the rich-text toolbar's Text colour and a
// table cell menu's Text row.
afterEach(cleanup);

const rect = { x: 0, y: 0 };
const text = (id: string, extra: object = {}) =>
  ({
    ...createText(rect.x + 40, rect.y + 40),
    id,
    width: 120,
    height: 30,
    label: 'Hi',
    ...extra,
  }) as BoxedElement;
const pale = text('pale', { textColor: '#fde047' });
const dark = text('dark', { textColor: '#0f172a' });
const activeTab = { elements: [pale, dark] as Element[] };
const wrap = ({ children }: { children: ReactNode }) => (
  <EditorContext.Provider value={{ activeTab } as never}>{children}</EditorContext.Provider>
);
const hint = () => screen.queryByTestId('contrast-hint');
// Opening focuses a swatch, which is judged; the pointer leaving the picker goes back to the colour in force.
const leave = (name: string) =>
  fireEvent.pointerLeave(screen.getByRole('group', { name }), { pointerType: 'mouse' });

describe('Quick Style More colours', () => {
  const more = (judgeIds?: string[]) =>
    render(
      <QuickMoreColours
        rowTitle="Text colour"
        value="#fde047"
        standard={standardGroup('strong', 'light', 'name')}
        judgeIds={judgeIds}
        onPick={vi.fn()}
      />,
      { wrapper: wrap },
    );

  it('judges the selected text on the Text colour row, the worst counting', () => {
    more(['pale', 'dark']);
    expect(hint()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More colours, text colour' }));
    leave('More colours, text colour');
    expect(hint()!.textContent).toContain('Hard to read for 1 of 2');
  });

  it('judges nothing on the other rows', () => {
    more();
    fireEvent.click(screen.getByRole('button', { name: 'More colours, text colour' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(hint()).toBeNull();
  });
});

describe('rich-text Text colour', () => {
  const toolbar = (colour: string | undefined, element: BoxedElement | undefined = dark) =>
    render(
      <RichTextToolbar
        active={{ color: colour } as never}
        alignX="left"
        alignY="top"
        onToggle={vi.fn()}
        onApplyList={vi.fn()}
        onApplyHeading={vi.fn()}
        listStyle="none"
        onColor={vi.fn()}
        onSetAlign={vi.fn()}
        element={element}
      />,
      { wrapper: wrap },
    );
  const open = () => fireEvent.click(screen.getByRole('button', { name: 'Text colour' }));

  it("judges the selected words' own colour where the element sits", () => {
    toolbar('#fde047');
    open();
    leave('Text colour');
    expect(hint()!.textContent).toContain('Hard to read on the canvas');
  });

  it('says when the words read', () => {
    toolbar('#0f172a');
    open();
    leave('Text colour');
    expect(hint()!.childElementCount).toBe(0);
    expect(document.querySelector('[data-contrast-reads]')!.textContent).toContain('Easy to read');
  });

  it("keeps the row for the element's colour when the words have none of their own", () => {
    toolbar(undefined);
    open();
    expect(document.querySelector('[data-contrast-row]')).not.toBeNull();
  });

  it('opens on the colour in force, not the first swatch it focuses, when the words have none of their own', async () => {
    toolbar(undefined);
    open();
    // The picker focuses its Tab stop a frame after opening: with no swatch picked, the first (a pale one).
    await act(() => new Promise((r) => requestAnimationFrame(() => r(undefined))));
    expect(document.activeElement?.getAttribute('aria-label')).not.toBe('Text colour');
    expect(hint()!.childElementCount).toBe(0);
    expect(document.querySelector('[data-contrast-reads]')!.textContent).toContain('Easy to read');
  });

  it('judges the stored element as saved on a dark canvas, not the light ink it is drawn in', () => {
    // Words with no colour of their own: the editor's element is projected for the dark canvas, its text
    // drawn in light ink, while the diagram is saved on the light paper with the dark default ink.
    const plain = text('plain');
    const projected = { ...plain, textColor: '#ffffff' } as BoxedElement;
    const tab = { elements: [plain] as Element[] };
    render(
      <EditorContext.Provider value={{ activeTab: tab } as never}>
        <CanvasSurfaceProvider surface="dark">
          <RichTextToolbar
            active={{ color: '#ffffff' } as never}
            alignX="left"
            alignY="top"
            onToggle={vi.fn()}
            onApplyList={vi.fn()}
            onApplyHeading={vi.fn()}
            listStyle="none"
            onColor={vi.fn()}
            onSetAlign={vi.fn()}
            element={projected}
          />
        </CanvasSurfaceProvider>
      </EditorContext.Provider>,
    );
    open();
    expect(hint()!.childElementCount).toBe(0);
    expect(document.querySelector('[data-contrast-reads]')!.textContent).toContain(
      'Easy to read on the light canvas',
    );
  });

  it('judges nothing without an element', () => {
    render(
      <RichTextToolbar
        active={{} as never}
        alignX="left"
        alignY="top"
        onToggle={vi.fn()}
        onApplyList={vi.fn()}
        onApplyHeading={vi.fn()}
        listStyle="none"
        onColor={vi.fn()}
        onSetAlign={vi.fn()}
      />,
    );
    open();
    expect(hint()).toBeNull();
  });
});

describe('table cell Text colour', () => {
  // jsdom has no ResizeObserver; the cell menu observes its own size.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  const table = {
    ...createTable(0, 0),
    id: 'tbl',
    cellStyles: [[{ bg: '#1e293b', textColor: '#334155' }]],
  } as TableElement;
  const cellTab = { ...activeTab, elements: [...activeTab.elements, table] as Element[] };

  it('judges the selected cells on their background, and Use colours their words', () => {
    const applyStyle = vi.fn();
    render(
      <EditorContext.Provider value={{ activeTab: cellTab } as never}>
        <TableCellMenu
          element={table}
          cells={[{ r: 0, c: 0 }]}
          anchor={{ r: 0, c: 0 }}
          position={{ x: 0, y: 0 }}
          onClose={vi.fn()}
          applyStyle={applyStyle}
          onClear={vi.fn()}
          textColor="#0f172a"
        />
      </EditorContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Colours/ }));
    const row = screen
      .getAllByRole('button', { name: /^Text/ })
      .find((b) => !b.hasAttribute('data-menu-section'))!;
    fireEvent.click(row);
    expect(hint()!.textContent).toContain('Hard to read on its cell');
    fireEvent.click(screen.getByRole('button', { name: /^Use #[0-9a-f]{6}, a lighter shade/ }));
    const picked = (applyStyle.mock.calls.at(-1)![0] as { textColor: string }).textColor;
    expect(contrastRatio(picked, '#1e293b')).toBeGreaterThanOrEqual(4.5);
  });
});
