// @vitest-environment jsdom

// One line of text edited in place on an element's face. Inert, it must not be focusable: the
// element around it is one `img`, and a focusable line inside it (even at tabindex -1) is a control
// nested in another (axe nested-interactive).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InlineTextLine } from './InlineTextLine';

afterEach(cleanup);

const line = (editable: boolean) =>
  render(
    <div role="img" aria-label="Card">
      <InlineTextLine
        value="Payments"
        placeholder="Title"
        editable={editable}
        onCommit={() => {}}
        zoom={1}
        maxLength={80}
        ariaLabel="Card title"
      />
    </div>,
  );

describe('InlineTextLine', () => {
  it('is out of the focus order entirely while inert', () => {
    line(false);
    const field = screen.getByRole('textbox', { name: 'Card title' });
    expect(field.hasAttribute('tabindex')).toBe(false);
    expect(field.getAttribute('contenteditable')).toBe('false');
    expect(field.textContent).toBe('Payments');
  });

  it('takes the Tab stop once it can be edited', () => {
    line(true);
    expect(screen.getByRole('textbox', { name: 'Card title' }).getAttribute('tabindex')).toBe('0');
  });

  // An element looks the same held, dragged and released as at rest
  // (web-components-and-no-groups.md): a press on a selected element's line is the element's until it
  // lets go where it started, and editing outlines the line without recolouring it, in every finish.
  describe.each(['professional', 'marker', 'sketch'])('in the %s finish', (finish) => {
    const held = () => {
      const onElementDown = vi.fn();
      render(
        <div data-face-finish={finish} role="img" aria-label="Card" onPointerDown={onElementDown}>
          <InlineTextLine
            value="Strategy"
            placeholder="Tier"
            editable
            onCommit={() => {}}
            zoom={1}
            maxLength={80}
            ariaLabel="Tier 2"
          />
        </div>,
      );
      const field = screen.getByRole('textbox', { name: 'Tier 2' });
      const down = fireEvent.pointerDown(field, { button: 0, clientX: 50, clientY: 20 });
      return { field, onElementDown, defaulted: down };
    };

    it('leaves a press to the element, unfocused, with no colour of its own', () => {
      const { field, onElementDown, defaulted } = held();
      expect(onElementDown).toHaveBeenCalledOnce();
      // The browser's own default (focus, a text selection) is held back.
      expect(defaulted).toBe(false);
      expect(document.activeElement).not.toBe(field);
      expect(field.className).not.toMatch(/(^|\s)(focus|active):(bg|text|fill|stroke)-/);
    });

    it('stays unfocused when the press becomes a drag', () => {
      const { field } = held();
      fireEvent.pointerUp(window, { button: 0, clientX: 90, clientY: 60 });
      expect(document.activeElement).not.toBe(field);
    });

    it('edits on a click, and then keeps its presses for the caret', () => {
      const { field, onElementDown } = held();
      fireEvent.pointerUp(window, { button: 0, clientX: 51, clientY: 21 });
      expect(document.activeElement).toBe(field);
      fireEvent.pointerDown(field, { button: 0, clientX: 52, clientY: 20 });
      expect(onElementDown).toHaveBeenCalledOnce();
    });
  });

  // docs/specs/008-canvas/finish.md "Performance": a zoom restyled every line on the board, so every Sketch and
  // Marker face took its finish again; the focus ring's width follows the zoom only while the line is edited.
  it('follows the zoom only while it is being edited', () => {
    const at = (zoom: number) => (
      <InlineTextLine
        value="Payments"
        placeholder="Title"
        editable
        onCommit={() => {}}
        zoom={zoom}
        maxLength={80}
        ariaLabel="Card title"
      />
    );
    const { rerender } = render(at(1));
    const field = screen.getByRole('textbox', { name: 'Card title' });
    const style = field.getAttribute('style');
    rerender(at(2));
    expect(field.getAttribute('style')).toBe(style);
    fireEvent.focus(field);
    rerender(at(4));
    expect(field.style.outlineWidth).toBe('0.25px');
  });
});
