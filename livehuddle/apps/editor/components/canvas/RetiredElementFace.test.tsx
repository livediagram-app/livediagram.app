// @vitest-environment jsdom

// A retired element's placeholder on the canvas (docs/specs/002-project-scope/not-in-livehuddle.md "Retired
// elements"): drawn from the one layout the export uses, untyped (no label editor, no settings, no controls), and
// deletable by an Editor like any element while a Viewer only sees it (docs/specs/013-workspace/share-roles.md).

import { cleanup, fireEvent, render } from '@testing-library/react';
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
import { CanvasZoomProvider } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { HIT_PAD_INWARD } from './element-parts';
import { SelectionGripsContext } from './SelectionGripsLayer';
import {
  RETIRED_DELETE_INSET,
  RETIRED_DELETE_MIN_HEIGHT,
  RETIRED_DELETE_MIN_WIDTH,
  RETIRED_DELETE_OUTSIDE,
  RETIRED_DELETE_SIZE,
  RetiredElementFace,
  retiredDeletePlacement,
  wordsClearOfDelete,
} from './RetiredElementFace';

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

// A diagram tool's embed as stored before #459 part 1: a retired element TYPE, not a shape kind.
const embed = (over: Record<string, unknown> = {}) =>
  ({
    id: 'yt',
    type: 'video',
    x: 0,
    y: 0,
    width: 480,
    height: 270,
    label: 'Launch video',
    link: { kind: 'url', url: 'https://www.youtube.com/watch?v=abc' },
    embedProvider: 'youtube',
    ...over,
  }) as unknown as Element & { width: number; height: number };

describe('RetiredElementFace on a retired type', () => {
  it('draws an embed as the same card, named Embed', () => {
    const { container } = render(
      <RetiredElementFace
        element={embed() as Parameters<typeof RetiredElementFace>[0]['element']}
      />,
    );
    const svg = container.querySelector('svg[data-retired-element="video"]')!;
    expect(svg).not.toBeNull();
    expect(lines(svg)).toEqual([
      ['name', 'Embed'],
      ['note', RETIRED_ELEMENT_NOTE],
      ['label', 'Launch video'],
    ]);
  });
});

// docs/specs/002-project-scope/not-in-livehuddle.md "Deleting it": the placeholder's one action, an Editor's alone.
describe('the placeholder Delete button', () => {
  const button = (root: ParentNode) =>
    root.querySelector<HTMLButtonElement>('button[data-retired-delete]');

  it('deletes the element by id, named for what it was, without starting a drag', () => {
    const onDelete = vi.fn();
    const onPointerDown = vi.fn();
    const { container } = render(
      <div onPointerDown={onPointerDown}>
        <RetiredElementFace element={board()} onDelete={onDelete} />
      </div>,
    );
    const b = button(container)!;
    expect(b.getAttribute('aria-label')).toBe('Delete Q&A Board');
    fireEvent.pointerDown(b);
    expect(onPointerDown).not.toHaveBeenCalled();
    fireEvent.click(b);
    expect(onDelete).toHaveBeenCalledWith('qa');
  });

  it('shows on hover and focus, and stays shown while selected (a touch has no hover)', () => {
    const idle = render(<RetiredElementFace element={board()} onDelete={() => {}} />);
    const quiet = button(idle.container)!.className;
    expect(quiet).toContain('opacity-0');
    expect(quiet).toContain('group-hover/el:opacity-100');
    expect(quiet).toContain('focus-visible:opacity-100');
    cleanup();
    const picked = render(<RetiredElementFace element={board()} selected onDelete={() => {}} />);
    expect(button(picked.container)!.className).toContain('opacity-100');
    expect(button(picked.container)!.className).not.toContain('opacity-0');
  });

  it('leaves a box too small to hold it with words only', () => {
    const narrow = render(
      <RetiredElementFace
        element={board({ width: RETIRED_DELETE_MIN_WIDTH - 1 })}
        onDelete={() => {}}
      />,
    );
    expect(button(narrow.container)).toBeNull();
    cleanup();
    const short = render(
      <RetiredElementFace
        element={board({ height: RETIRED_DELETE_MIN_HEIGHT - 1 })}
        onDelete={() => {}}
      />,
    );
    expect(button(short.container)).toBeNull();
    cleanup();
    // Big enough, but the name, centred across so narrow a card, reaches the button's corner.
    const crowded = render(
      <RetiredElementFace
        element={board({ width: RETIRED_DELETE_MIN_WIDTH, height: RETIRED_DELETE_MIN_HEIGHT })}
        onDelete={() => {}}
      />,
    );
    expect(button(crowded.container)).toBeNull();
    cleanup();
    // As narrow, but tall enough that the words start below the button.
    const fits = render(
      <RetiredElementFace
        element={board({ width: RETIRED_DELETE_MIN_WIDTH, height: 140 })}
        onDelete={() => {}}
      />,
    );
    expect(button(fits.container)).not.toBeNull();
  });

  it('keeps the button off the words: a line clears it by starting below it or ending left of it', () => {
    const at = (shape: string, width: number, height: number) =>
      wordsClearOfDelete(
        retiredPlaceholderLayout({ type: 'shape', shape, label: '', width, height }),
        width,
      );
    // A short name on a short, wide card ends well left of the corner; the note starts below the button.
    expect(at('rating', 160, 80)).toBe(true);
    // The same name on a smaller card runs into the corner.
    expect(at('rating', 100, 56)).toBe(false);
    // A long name on that wide card reaches it too.
    expect(at('progress-ring', 160, 80)).toBe(false);
    // The words of a big card sit well below it.
    expect(at('pie-chart', 320, 220)).toBe(true);
  });

  it("keeps one size on screen at every zoom, counter-scaled in the card's top-right corner", () => {
    const big = board({ width: 480, height: 320 });
    for (const zoom of [0.5, 1, 2]) {
      const { container } = render(
        <CanvasZoomProvider zoom={zoom}>
          <RetiredElementFace element={big} onDelete={() => {}} />
        </CanvasZoomProvider>,
      );
      const b = button(container)!;
      expect(b.getAttribute('data-retired-delete')).toBe('inside');
      expect(b.className).toContain('h-6 w-6');
      const slot = container.querySelector<HTMLElement>('[data-retired-delete-slot]')!;
      expect(slot.style.transform).toBe(`scale(${1 / zoom})`);
      expect(slot.style.transformOrigin).toBe('0 0');
      // 12 screen pixels in from the top and right edges, measured back into the card's units.
      expect(parseFloat(slot.style.top)).toBeCloseTo(RETIRED_DELETE_INSET / zoom);
      expect(parseFloat(slot.style.left)).toBeCloseTo(
        (480 * zoom - RETIRED_DELETE_INSET - RETIRED_DELETE_SIZE) / zoom,
      );
      cleanup();
    }
  });

  it('measures the room on screen: a card big in its own units but small on screen holds no button inside', () => {
    const pie = board({ width: 320, height: 220, shape: 'pie-chart' });
    const at = (zoom: number) => {
      const { container } = render(
        <CanvasZoomProvider zoom={zoom}>
          <RetiredElementFace element={pie} onDelete={() => {}} />
        </CanvasZoomProvider>,
      );
      const found = button(container)?.getAttribute('data-retired-delete') ?? null;
      cleanup();
      return found;
    };
    expect(at(1)).toBe('inside');
    // A phone's Fit zoom: the card is 80 by 55 on screen and its name reaches the corner.
    expect(at(0.25)).toBeNull();
  });

  it('shows outside the card, up in the grips layer, when the selected card is too small on screen', () => {
    const host = document.createElement('div');
    const arrows = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    document.body.appendChild(host);
    const onDelete = vi.fn();
    const pie = board({ x: 40, y: 80, width: 320, height: 220, shape: 'pie-chart' });
    const { container } = render(
      <SelectionGripsContext.Provider value={{ box: host, arrows }}>
        <CanvasZoomProvider zoom={0.25}>
          <RetiredElementFace element={pie} selected onDelete={onDelete} />
        </CanvasZoomProvider>
      </SelectionGripsContext.Provider>,
    );
    expect(button(container)).toBeNull();
    const b = button(host)!;
    expect(b.getAttribute('data-retired-delete')).toBe('outside');
    const frame = host.querySelector<HTMLElement>('[data-ride-id="qa"]')!;
    expect(frame.style.left).toBe('40px');
    expect(frame.style.top).toBe('80px');
    const slot = host.querySelector<HTMLElement>('[data-retired-delete-slot]')!;
    expect(slot.style.transform).toBe('scale(4)');
    expect(parseFloat(slot.style.left)).toBeCloseTo((320 * 0.25 + RETIRED_DELETE_OUTSIDE) / 0.25);
    fireEvent.pointerDown(b);
    fireEvent.click(b);
    expect(onDelete).toHaveBeenCalledWith('qa');
    host.remove();
  });

  it("never sits on a selection grip's touch pad, inside or outside, at any size or zoom", () => {
    // The grips on screen (element-parts.tsx): a 12px corner grip and a 6 by 16 edge grip centred on the edge, each
    // with a touch pad 16px out and 4px in past the grip (HIT_PAD_INWARD).
    for (const classes of Object.values(HIT_PAD_INWARD)) expect(classes).toContain('[-4px]');
    type Rect = { x0: number; y0: number; x1: number; y1: number };
    const pads = (w: number, h: number): Rect[] => [
      { x0: -22, y0: -22, x1: 10, y1: 10 },
      { x0: w - 10, y0: -22, x1: w + 22, y1: 10 },
      { x0: -22, y0: h - 10, x1: 10, y1: h + 22 },
      { x0: w - 10, y0: h - 10, x1: w + 22, y1: h + 22 },
      { x0: w / 2 - 24, y0: -19, x1: w / 2 + 24, y1: 7 },
      { x0: w / 2 - 24, y0: h - 7, x1: w / 2 + 24, y1: h + 19 },
      { x0: -19, y0: h / 2 - 24, x1: 7, y1: h / 2 + 24 },
      { x0: w - 7, y0: h / 2 - 24, x1: w + 19, y1: h / 2 + 24 },
    ];
    const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    const seen = { inside: 0, outside: 0 };
    const sizes: [number, number][] = [
      [40, 30],
      [72, 48],
      [100, 56],
      [160, 80],
      [240, 160],
      [320, 220],
      [800, 600],
    ];
    for (const zoom of [0.1, 0.25, 0.5, 1, 2, 4])
      for (const [w, h] of sizes) {
        const card = retiredPlaceholderLayout({
          type: 'shape',
          shape: 'pie-chart',
          label: '',
          width: w,
          height: h,
        });
        const place = retiredDeletePlacement(card, w, h, zoom, true)!;
        seen[place.where] += 1;
        const bin = {
          x0: place.left,
          y0: place.top,
          x1: place.left + place.size,
          y1: place.top + place.size,
        };
        for (const pad of pads(w * zoom, h * zoom))
          expect(overlaps(bin, pad), `${w}x${h} at ${zoom}`).toBe(false);
      }
    expect(seen.inside).toBeGreaterThan(0);
    expect(seen.outside).toBeGreaterThan(0);
  });

  it('shows nowhere on a card too small on screen that is not selected, nor on an empty box', () => {
    const layout = (width: number, height: number) =>
      retiredPlaceholderLayout({ type: 'shape', shape: 'pie-chart', label: '', width, height });
    expect(retiredDeletePlacement(layout(40, 30), 40, 30, 1, false)).toBeNull();
    expect(retiredDeletePlacement(layout(0, 0), 0, 0, 1, true)).toBeNull();
  });

  it('is not there without a delete handler', () => {
    const { container } = render(<RetiredElementFace element={board()} />);
    expect(button(container)).toBeNull();
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

  it('routes a retired type to the placeholder too', () => {
    const props = {
      element: embed(),
      isEditing: false,
      readOnly: false,
      fontFamily: undefined,
    } as unknown as Parameters<typeof ElementFaceRouter>[0];
    const { container } = render(<ElementFaceRouter {...props} />);
    expect(container.querySelector('[data-retired-element="video"]')).not.toBeNull();
  });

  it('hands the Delete button on to an editable surface, and holds it back from a read-only one', () => {
    const onDeleteRetired = vi.fn();
    const props = (readOnly: boolean) =>
      ({
        element: board(),
        isEditing: false,
        isSelected: true,
        readOnly,
        onDeleteRetired,
      }) as unknown as Parameters<typeof ElementFaceRouter>[0];
    const editable = render(<ElementFaceRouter {...props(false)} />);
    fireEvent.click(editable.container.querySelector('button[data-retired-delete]')!);
    expect(onDeleteRetired).toHaveBeenCalledWith('qa');
    cleanup();
    const readOnly = render(<ElementFaceRouter {...props(true)} />);
    expect(readOnly.container.querySelector('button')).toBeNull();
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
    });
    actions.deleteSelected();
    expect(after).toEqual([]);
  });

  it('the placeholder Delete removes it by id, whatever is selected, as one change', () => {
    const el = board();
    const other = board({ id: 'keep' });
    const commits: Element[][] = [];
    const actions = buildSelectionActions({
      currentSelectionIds: () => new Set(['keep']),
      readSelection: () => ({ selectedId: 'keep', multiSelectedIds: new Set<string>() }),
      activeTab: { id: 't', name: 'T', elements: [el, other] },
      commit: (map) => {
        commits.push(map([el, other]));
      },
      setSelectedId: () => {},
      setEditingId: () => {},
      setMultiSelectedIds: () => {},
      setFormatSourceId: () => {},
      lockedByOther: () => false,
    });
    actions.deleteElementById('qa');
    expect(commits).toEqual([[other]]);
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
