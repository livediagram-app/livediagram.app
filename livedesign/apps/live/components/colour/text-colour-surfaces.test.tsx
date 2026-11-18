// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createText, layOutPages, type BoxedElement, type Element } from '@livedesign/design';
import { EditorContext } from '@/app/design/[id]/EditorContext';
import { QuickMoreColours } from '@/components/canvas/QuickMoreColours';
import { RichTextToolbar } from '@/components/canvas/RichTextToolbar';
import { standardGroup } from './colour-options';

// docs/specs/004-interface-design/colour-picker.md "Reading on its ground": every picker that colours
// text judges it, the Quick Style bar's Text colour More colours and the rich-text toolbar's Text colour.
afterEach(cleanup);

const PAGE = { id: 'p', orientation: 'portrait' } as const;
const rect = layOutPages([PAGE])[0]!.rect;
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
const activeTab = { elements: [pale, dark] as Element[], pages: [PAGE] };
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
    expect(hint()!.textContent).toContain('Hard to read on this page');
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
