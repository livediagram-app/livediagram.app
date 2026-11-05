// @vitest-environment jsdom

// A retired element's placeholder on the canvas (docs/specs/002-project-scope/not-in-livehuddle.md "Retired
// elements"): drawn from the one layout the export uses, untyped (no label editor, no settings, no controls), and
// deletable by an Editor like any element while a Viewer only sees it (docs/specs/013-workspace/share-roles.md).

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RETIRED_ELEMENT_NOTE,
  RETIRED_PLACEHOLDER_COLOURS,
  retiredPlaceholderLayout,
  type Element,
  type ShapeElement,
} from '@livehuddle/document';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { useElementSelectionActions as buildSelectionActions } from '@/hooks/canvas/useElementSelectionActions';
import { CanvasSurfaceProvider } from './CanvasSurfaceContext';
import { ElementFaceRouter } from './ElementFaceRouter';
import { RetiredElementFace } from './RetiredElementFace';

vi.mock('@/lib/telemetry', () => ({ track: () => {} }));

afterEach(cleanup);

// A Q&A board as stored before part 4, with fields only the deleted code knew.
const board = (over: Record<string, unknown> = {}) =>
  ({
    id: 'qa',
    type: 'shape',
    shape: 'qa-board',
    x: 0,
    y: 0,
    width: 240,
    height: 160,
    label: 'Ask us anything',
    qaNotes: [{ id: 'n1', text: 'When do we ship?', votes: 3 }],
    ...over,
  }) as unknown as ShapeElement;

const lines = (root: ParentNode) =>
  [...root.querySelectorAll('[data-retired-line]')].map((n) => [
    n.getAttribute('data-retired-line'),
    n.textContent,
  ]);

describe('RetiredElementFace', () => {
  it('draws the name, the note and the label, centred, in a dashed muted card', () => {
    const { container } = render(<RetiredElementFace element={board()} />);
    const svg = container.querySelector('svg[data-retired-element="qa-board"]')!;
    expect(svg).not.toBeNull();
    expect(lines(svg)).toEqual([
      ['name', 'Q&A Board'],
      ['note', RETIRED_ELEMENT_NOTE],
      ['label', 'Ask us anything'],
    ]);
    const rect = svg.querySelector('rect')!;
    expect(rect.getAttribute('stroke-dasharray')).toBe('6 4');
    expect(rect.getAttribute('stroke-width')).toBe('1.5');
    expect(rect.getAttribute('fill')).toBe(RETIRED_PLACEHOLDER_COLOURS.light.fill);
    expect(rect.getAttribute('stroke')).toBe(RETIRED_PLACEHOLDER_COLOURS.light.stroke);
    for (const text of svg.querySelectorAll('text')) {
      expect(text.getAttribute('text-anchor')).toBe('middle');
      expect(text.getAttribute('x')).toBe('120');
    }
  });

  it('matches the layout the export draws from, line for line', () => {
    const el = board();
    const card = retiredPlaceholderLayout(el);
    const { container } = render(<RetiredElementFace element={el} />);
    const texts = [...container.querySelectorAll('text')];
    expect(texts.map((t) => Number(t.getAttribute('y')))).toEqual(
      card.lines.map((l) => l.baseline),
    );
    expect(texts.map((t) => Number(t.getAttribute('font-size')))).toEqual(
      card.lines.map((l) => l.size),
    );
  });

  it('drops the label, then the note, as the box gets short, and cuts a long label with an ellipsis', () => {
    const short = render(<RetiredElementFace element={board({ height: 56 })} />);
    expect(lines(short.container).map(([role]) => role)).toEqual(['name', 'note']);
    cleanup();
    const tiny = render(<RetiredElementFace element={board({ height: 20, width: 60 })} />);
    expect(lines(tiny.container).map(([role]) => role)).toEqual(['name']);
    cleanup();
    const long = render(
      <RetiredElementFace
        element={board({ label: 'A very long question nobody will read '.repeat(4) })}
      />,
    );
    expect(lines(long.container).find(([role]) => role === 'label')![1]).toMatch(/…$/);
  });

  it('names a session button after its tool, and leaves out an empty label', () => {
    const { container } = render(
      <RetiredElementFace
        element={board({ shape: 'session-button', session: { tool: 'timer' }, label: '  ' })}
      />,
    );
    expect(lines(container)).toEqual([
      ['name', 'Timer'],
      ['note', RETIRED_ELEMENT_NOTE],
    ]);
  });

  it('wears the dark paper on a dark canvas, and the element’s label font', () => {
    const { container } = render(
      <CanvasSurfaceProvider surface="dark">
        <RetiredElementFace element={board()} fontFamily="'Caveat', cursive" />
      </CanvasSurfaceProvider>,
    );
    const svg = container.querySelector('svg')!;
    expect(svg.querySelector('rect')!.getAttribute('fill')).toBe(
      RETIRED_PLACEHOLDER_COLOURS.dark.fill,
    );
    expect(svg.querySelector('text')!.getAttribute('fill')).toBe(
      RETIRED_PLACEHOLDER_COLOURS.dark.ink,
    );
    expect(svg.style.fontFamily).toContain('Caveat');
  });

  it('is inert: the wrapper around it selects and drags', () => {
    const { container } = render(<RetiredElementFace element={board()} />);
    expect(container.querySelector('svg')!.getAttribute('class')).toContain('pointer-events-none');
  });
});

describe('ElementFaceRouter on a retired element', () => {
  // Untyped: even while "editing" it offers no label editor, no settings button and nothing to press.
  it('routes to the placeholder ahead of every kind face, with no control in it', () => {
    const props = {
      element: board(),
      isEditing: true,
      readOnly: false,
      fontFamily: undefined,
    } as unknown as Parameters<typeof ElementFaceRouter>[0];
    const { container } = render(<ElementFaceRouter {...props} />);
    expect(container.querySelector('[data-retired-element="qa-board"]')).not.toBeNull();
    expect(container.querySelector('textarea, input, button, [contenteditable]')).toBeNull();
  });
});

// docs/specs/013-workspace/share-roles.md: a retired element is an element like any other to the roles.
describe('a retired element and the share roles', () => {
  it('an Editor may delete it, and the delete takes it off the canvas', () => {
    const can = resolveEditorCapabilities({ level: 'edit', adderKey: null });
    const el = board();
    expect(can.remove(el)).toBe(true);
    let after: Element[] | null = null;
    const selection = new Set(['qa']);
    const actions = buildSelectionActions({
      currentSelectionIds: () => selection,
      readSelection: () => ({ selectedId: 'qa', multiSelectedIds: selection }),
      activeTab: { id: 't', name: 'T', elements: [el] },
      commit: (map) => {
        after = map([el]);
      },
      setSelectedId: () => {},
      setEditingId: () => {},
      setMultiSelectedIds: () => {},
      setFormatSourceId: () => {},
      lockedByOther: () => false,
      layerLockedIds: new Set<string>(),
      layerInertIds: new Set<string>(),
    });
    actions.deleteSelected();
    expect(after).toEqual([]);
  });

  it('a Viewer sees it and may change nothing on it', () => {
    const can = resolveEditorCapabilities({ level: 'view', adderKey: 'a'.repeat(32) });
    const el = board();
    expect(
      [can.remove, can.move, can.resize, can.recolour, can.writeText].map((f) => f(el)),
    ).toEqual([false, false, false, false, false]);
    const { container } = render(<RetiredElementFace element={el} />);
    expect(container.querySelector('[data-retired-element]')).not.toBeNull();
    expect(container.querySelector('textarea, input, button')).toBeNull();
  });

  it('a Participant writes no text on it, and removes it only when they placed it', () => {
    const key = 'b'.repeat(32);
    const can = resolveEditorCapabilities({ level: 'participate', adderKey: key });
    expect(can.writeText(board())).toBe(false);
    expect(can.remove(board())).toBe(false);
  });
});
