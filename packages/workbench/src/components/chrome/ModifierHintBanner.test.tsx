// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelectionStoreProvider } from '../../hooks/canvas/useSelectionStore';
import { createSelectionStore } from '../../lib/selection-store';
import {
  ModifierHint,
  ModifierHintBanner,
  selectedKindOf,
  shiftHintMessage,
  type HintDrag,
} from './ModifierHintBanner';

// The modifier hint every editor mounts (each editor's docs/specs/008-canvas/canvas-and-palette.md).

// A stand-in for ToolbarPalette's strip card, at a known place on screen (PaletteTray.test.tsx).
function mountStrip() {
  const root = document.createElement('div');
  root.setAttribute('data-toolbar-palette', '');
  const card = document.createElement('div');
  card.setAttribute('data-tour-id', 'palette');
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(new DOMRect(300, 12, 600, 46));
  root.append(card);
  document.body.append(root);
}

function holdShift(down: boolean) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: 'Shift' }));
  });
}

function show(props: Partial<Parameters<typeof ModifierHintBanner>[0]> = {}) {
  return render(<ModifierHintBanner drag={null} hasElements {...props} />);
}

const MOVE: HintDrag = { kind: 'boxed', mode: 'move' };
const RESIZE: HintDrag = { kind: 'boxed', mode: 'resize-se' };

afterEach(() => {
  cleanup();
  holdShift(false);
  document.body.innerHTML = '';
});

describe('ModifierHintBanner', () => {
  it('says nothing when no modifier is worth naming', () => {
    show();
    expect(screen.queryByText(/shift|alt/i)).toBeNull();
  });

  it('names what Shift is doing while it is held, as a top-centre pill', () => {
    show();
    holdShift(true);
    expect(screen.getByText(/click elements to select several/i)).toBeTruthy();
    expect(screen.getByText('⇧ Shift').tagName).toBe('KBD');
    expect(document.querySelector('[data-mode-message]')).not.toBeNull();
  });

  it('is suppressed while a mode banner owns the slot', () => {
    show({ suppressed: true, altHint: 'Press to do it' });
    holdShift(true);
    expect(screen.queryByText(/select several|press to do it/i)).toBeNull();
  });

  it('says nothing held over an empty canvas', () => {
    show({ hasElements: false });
    holdShift(true);
    expect(screen.queryByText(/shift/i)).toBeNull();
  });

  it('names the aspect lock while resizing, and nothing while moving', () => {
    const { rerender } = show({ drag: RESIZE });
    holdShift(true);
    expect(screen.getByText(/proportions locked/i)).toBeTruthy();
    rerender(<ModifierHintBanner drag={MOVE} hasElements />);
    expect(screen.queryByText(/proportions locked|select several/i)).toBeNull();
  });

  it('offers an Alt gesture while Shift is up, and stands it down while Shift is held', () => {
    show({ drag: MOVE, altHint: 'Press to insert it between two notes' });
    expect(screen.getByText(/insert it between two notes/i)).toBeTruthy();
    expect(screen.getByText('Alt')).toBeTruthy();
    holdShift(true);
    expect(screen.queryByText(/insert it between/i)).toBeNull();
  });

  it("says the editor's own Shift message in place of the canvas's (livehuddle's walk)", () => {
    show({ shiftMessage: 'Running', drag: RESIZE });
    holdShift(true);
    expect(screen.getByText('Running')).toBeTruthy();
    expect(screen.queryByText(/proportions locked/i)).toBeNull();
  });

  it('hangs under the palette strip as its tray in the Toolbar layout', () => {
    mountStrip();
    show();
    holdShift(true);
    expect(screen.getByText(/click elements to select several/i)).toBeTruthy();
    expect(document.querySelector('[data-palette-tray]')).not.toBeNull();
    // Not the top-centre pill's fixed row.
    expect(document.querySelector('.top-16')).toBeNull();
  });
});

describe('shiftHintMessage', () => {
  it('picks the most specific message first', () => {
    const drawing: HintDrag = { kind: 'arrow-endpoint', end: 'to' };
    expect(shiftHintMessage(drawing, null, true)).toBe('Click places it and starts another arrow');
    // Moving an existing arrow's end, or its tail: Shift does nothing.
    expect(shiftHintMessage({ ...drawing, reposition: true }, null, true)).toBeNull();
    expect(shiftHintMessage({ kind: 'arrow-endpoint', end: 'from' }, null, true)).toBeNull();
    expect(shiftHintMessage(RESIZE, null, true)).toBe('Proportions locked');
    expect(shiftHintMessage(MOVE, 'arrow', true)).toBeNull();
    expect(shiftHintMessage({ kind: 'arrow-curve' }, null, true)).toBeNull();
    expect(shiftHintMessage(null, 'arrow', true)).toBe(
      'Drag an arrowhead to split it into a branch',
    );
    expect(shiftHintMessage(null, 'table', true)).toBe('Click cells to select several');
    expect(shiftHintMessage(null, 'other', true)).toBe('Click elements to select several');
    expect(shiftHintMessage(null, null, false)).toBeNull();
  });
});

describe('selectedKindOf', () => {
  const els = [
    { id: 'r', type: 'arrow' },
    { id: 't', type: 'table' },
    { id: 's', type: 'shape' },
  ];

  it('names the selected element’s flavour for the no-drag hints, or null', () => {
    expect(selectedKindOf(els, 'r')).toBe('arrow');
    expect(selectedKindOf(els, 't')).toBe('table');
    expect(selectedKindOf(els, 's')).toBe('other');
    expect(selectedKindOf(els, null)).toBeNull();
    expect(selectedKindOf(els, 'gone')).toBeNull();
  });
});

describe('ModifierHint', () => {
  const els = [
    { id: 'r', type: 'arrow' },
    { id: 't', type: 'table' },
  ];

  function mount(selectedId: string, readOnly?: boolean) {
    const store = createSelectionStore();
    store.setSelectedId(selectedId);
    return render(
      <SelectionStoreProvider store={store}>
        <ModifierHint elements={els} drag={null} hasElements readOnly={readOnly} />
      </SelectionStoreProvider>,
    );
  }

  it('reads the selection from the store: a selected arrow offers its branch', () => {
    mount('r');
    holdShift(true);
    expect(screen.getByText(/split it into a branch/i)).toBeTruthy();
  });

  it('gives a read-only session the general hint for a selected arrow (share roles)', () => {
    mount('r', true);
    holdShift(true);
    expect(screen.getByText(/click elements to select several/i)).toBeTruthy();
  });

  it('keeps a read-only session’s table hint', () => {
    mount('t', true);
    holdShift(true);
    expect(screen.getByText(/click cells to select several/i)).toBeTruthy();
  });
});
