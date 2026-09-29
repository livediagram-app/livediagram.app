// @vitest-environment jsdom

// The Picker's option list (docs/specs/012-collaboration/picker.md) is a draft committed on blur: it
// follows the element's options when they change, and an unrelated re-render of the menu never
// wipes what the user is typing.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShapeElement } from '@livediagram/document';
import { PickerMenuSection } from './BehaviourMenuSections';

const picker = (over: Partial<ShapeElement> = {}): ShapeElement =>
  ({ id: 'p1', type: 'rectangle', pickerSource: 'options', ...over }) as ShapeElement;

function renderSection(element: ShapeElement, onSetPickerOptions = vi.fn()) {
  const ui = (el: ShapeElement) => (
    <PickerMenuSection
      element={el}
      onSetPickerSource={vi.fn()}
      onSetPickerOptions={onSetPickerOptions}
      sectionProps={{ open: true, onToggle: vi.fn() }}
    />
  );
  const result = render(ui(element));
  return { ...result, rerenderWith: (el: ShapeElement) => result.rerender(ui(el)) };
}

const textarea = () => screen.getByRole('textbox') as HTMLTextAreaElement;

afterEach(() => cleanup());

describe('PickerMenuSection options', () => {
  it('seeds from the element options, one per line', () => {
    renderSection(picker({ pickerOptions: ['Ada', 'Bob'] }));
    expect(textarea().value).toBe('Ada\nBob');
  });

  it('follows the element when its options change', () => {
    const { rerenderWith } = renderSection(picker({ pickerOptions: ['Ada'] }));
    rerenderWith(picker({ pickerOptions: ['Ada', 'Cy'] }));
    expect(textarea().value).toBe('Ada\nCy');
  });

  it('keeps an uncommitted draft through a re-render with no options yet', () => {
    const { rerenderWith } = renderSection(picker());
    fireEvent.change(textarea(), { target: { value: 'Ada' } });
    rerenderWith(picker());
    expect(textarea().value).toBe('Ada');
  });

  it('commits the trimmed, non-empty lines on blur', () => {
    const onSet = vi.fn();
    renderSection(picker(), onSet);
    fireEvent.change(textarea(), { target: { value: ' Ada \n\nBob' } });
    fireEvent.blur(textarea());
    expect(onSet).toHaveBeenCalledWith(['Ada', 'Bob']);
  });
});
