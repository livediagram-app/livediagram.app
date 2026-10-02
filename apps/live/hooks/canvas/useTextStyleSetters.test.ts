// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createText, type Element, type Tab, type TextElement } from '@livediagram/document';
import { useTextStyleSetters } from './useTextStyleSetters';

// Stands in for the DOM measure: the text block is 10 px a character at 14 px, scaled with the
// label px, one line of 1.25 leading.
vi.mock('@/components/canvas/text-hug-measure', () => ({
  measureDrawnText: () => (el: TextElement) => () => {
    const px = { sm: 14, md: 22, lg: 32, scale: 16 }[el.textSize ?? 'scale'] * (el.textScale ?? 1);
    const bold = el.textBold ? 1.2 : 1;
    return { width: (((el.label ?? '').length * 10 * px) / 14) * bold, height: px * 1.25 };
  },
}));

// A text box whose edits land through the setters, in Draw mode (true) or Diagram mode (false).
function setup(drawMode: boolean, el: TextElement) {
  let els: Element[] = [el];
  const commit = (map: (els: Element[]) => Element[]) => {
    els = map(els);
  };
  const { result } = renderHook(() =>
    useTextStyleSetters({
      currentSelectionIds: () => new Set([el.id]),
      selectionPrimary: () => els[0]!,
      commit,
      activeTab: { font: undefined } as unknown as Tab,
      drawMode,
    }),
  );
  return { setters: result.current, current: () => els[0] as TextElement };
}

const hello = (patch: Partial<TextElement> = {}): TextElement => ({
  ...createText(0, 0),
  label: 'Hello',
  autoWidth: true,
  width: 58,
  height: 22,
  textSize: 'sm',
  ...patch,
});

// docs/specs/023-whiteboard/whiteboard.md "Text boxes": the box hugs its text through every
// change to how the text is drawn.
describe('useTextStyleSetters on a whiteboard text box', () => {
  it('re-hugs the box when the text size changes, and drops a Shift scale', () => {
    const { setters, current } = setup(true, hello({ textScale: 2 }));
    setters.setTextSizeSelected('md');
    // 5 characters at 22 px: 78.57 wide, rounded up, plus 8; 27.5 tall, rounded up, plus 4.
    expect(current()).toMatchObject({ textSize: 'md', width: 87, height: 32 });
    expect(current().textScale).toBeUndefined();
  });

  it('re-hugs the box when bold is toggled', () => {
    const { setters, current } = setup(true, hello());
    setters.toggleTextStyleSelected('textBold');
    expect(current()).toMatchObject({ textBold: true, width: 68, height: 22 });
  });

  it('re-hugs the box when the font changes', () => {
    const { setters, current } = setup(true, hello({ width: 200 }));
    setters.setFontSelected('caveat');
    expect(current()).toMatchObject({ font: 'caveat', width: 58 });
  });

  it('leaves a Diagram mode text box its size', () => {
    const { setters, current } = setup(false, hello({ width: 220, height: 64 }));
    setters.setTextSizeSelected('lg');
    expect(current()).toMatchObject({ textSize: 'lg', width: 220, height: 64 });
  });
});
