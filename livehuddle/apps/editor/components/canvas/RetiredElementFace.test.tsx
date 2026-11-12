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
import { storedAnnotation, storedFreehand, storedPath } from '@/test/retired-elements';
import { CanvasSurfaceProvider } from './CanvasSurfaceContext';
import { ElementFaceRouter } from './ElementFaceRouter';
import { CanvasZoomProvider } from '@liveworkspace/workbench/components/canvas/CanvasZoomContext';
import { HIT_PAD_INWARD } from './element-parts';
import { SelectionGripsContext } from '@liveworkspace/workbench/components/canvas/SelectionGripsLayer';
import {
  RETIRED_DELETE_INSET,
  RETIRED_DELETE_MIN_HEIGHT,
  RETIRED_DELETE_MIN_WIDTH,
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
        <RetiredElementFace element={board()} fontFamily="'Kalam', cursive" />
      </CanvasSurfaceProvider>,
    );
    const svg = container.querySelector('svg')!;
    expect(svg.querySelector('rect')!.getAttribute('fill')).toBe(
      RETIRED_PLACEHOLDER_COLOURS.dark.fill,
    );
    expect(svg.querySelector('text')!.getAttribute('fill')).toBe(
      RETIRED_PLACEHOLDER_COLOURS.dark.ink,
    );
    expect(svg.style.fontFamily).toContain('Kalam');
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
// Screen-pixel boxes for the button's placement checks.
type Rect = { x0: number; y0: number; x1: number; y1: number };
const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const binRect = (p: { left: number; top: number; size: number }): Rect => ({
  x0: p.left,
  y0: p.top,
  x1: p.left + p.size,
  y1: p.top + p.size,
});
const layoutOf = (width: number, height: number) =>
  retiredPlaceholderLayout({ type: 'shape', shape: 'pie-chart', label: '', width, height });
const SIZES: [number, number][] = [
  [40, 30],
  [72, 48],
  [100, 56],
  [160, 80],
  [240, 160],
  [320, 220],
  [800, 600],
];

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

  it('ignores the click of a tap that began on the card, so the tap that selects it never deletes', () => {
    const onDelete = vi.fn();
    const { container } = render(
      <RetiredElementFace element={board()} selected onDelete={onDelete} />,
    );
    const b = button(container)!;
    // The selecting tap pressed the card, then the button appeared under the finger before the click.
    fireEvent.click(b, { detail: 1 });
    expect(onDelete).not.toHaveBeenCalled();
    // A press cancelled on the button doesn't arm the next click either.
    fireEvent.pointerDown(b);
    fireEvent.pointerCancel(b);
    fireEvent.click(b, { detail: 1 });
    expect(onDelete).not.toHaveBeenCalled();
    // A press on the button, or the keyboard (a click with detail 0), deletes.
    fireEvent.pointerDown(b);
    fireEvent.click(b, { detail: 1 });
    fireEvent.click(b, { detail: 0 });
    expect(onDelete).toHaveBeenCalledTimes(2);
  });

  it('shows on hover and focus, and stays shown while selected (a touch has no hover)', () => {
    const idle = render(<RetiredElementFace element={board()} onDelete={() => {}} />);
    const quiet = button(idle.container)!.className;
    expect(quiet).toContain('opacity-0');
    expect(quiet).toContain('group-hover/el:opacity-100');
    expect(quiet).toContain('focus-visible:opacity-100');
    // Hidden, it takes no tap: a touch on an unselected card never deletes it unseen.
    expect(quiet.split(' ')).toContain('pointer-events-none');
    expect(quiet).toContain('group-hover/el:pointer-events-auto');
    cleanup();
    const picked = render(<RetiredElementFace element={board()} selected onDelete={() => {}} />);
    expect(button(picked.container)!.className).toContain('opacity-100');
    expect(button(picked.container)!.className).not.toContain('opacity-0');
    expect(button(picked.container)!.className.split(' ')).toContain('pointer-events-auto');
    expect(button(picked.container)!.className.split(' ')).not.toContain('pointer-events-none');
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
      expect(button(container)!.className).toContain('h-6 w-6');
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

  it('only ever shows inside the card: none outside it, or in the grips layer, at any zoom', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const pie = board({ x: 40, y: 80, width: 320, height: 220, shape: 'pie-chart' });
    for (const zoom of [0.1, 0.25, 0.5, 1, 2, 4]) {
      for (const selected of [false, true]) {
        const { container } = render(
          <SelectionGripsContext.Provider
            value={{
              box: host,
              arrows: document.createElementNS('http://www.w3.org/2000/svg', 'g'),
            }}
          >
            <CanvasZoomProvider zoom={zoom}>
              <RetiredElementFace element={pie} selected={selected} onDelete={() => {}} />
            </CanvasZoomProvider>
          </SelectionGripsContext.Provider>,
        );
        expect(host.childElementCount, `zoom ${zoom}`).toBe(0);
        const slot = container.querySelector<HTMLElement>('[data-retired-delete-slot]');
        if (slot) {
          const left = parseFloat(slot.style.left) * zoom;
          const top = parseFloat(slot.style.top) * zoom;
          expect(left).toBeGreaterThanOrEqual(RETIRED_DELETE_INSET);
          expect(left + RETIRED_DELETE_SIZE).toBeLessThanOrEqual(320 * zoom - RETIRED_DELETE_INSET);
          expect(top + RETIRED_DELETE_SIZE).toBeLessThanOrEqual(220 * zoom);
        }
        cleanup();
      }
    }
    // A phone's Fit zoom: the card is 80 by 55 on screen and its name reaches the corner, so it shows none; the
    // selection toolbar's Delete removes it.
    const fit = render(
      <CanvasZoomProvider zoom={0.25}>
        <RetiredElementFace element={pie} selected onDelete={() => {}} />
      </CanvasZoomProvider>,
    );
    expect(button(fit.container)).toBeNull();
    host.remove();
  });

  it("never sits on a selection grip's touch pad, at any size or zoom", () => {
    // The grips on screen (element-parts.tsx): a 12px corner grip and a 6 by 16 edge grip centred on the edge, each
    // with a touch pad 16px out and 4px in past the grip (HIT_PAD_INWARD).
    for (const classes of Object.values(HIT_PAD_INWARD)) expect(classes).toContain('[-4px]');
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
    let shown = 0;
    for (const zoom of [0.1, 0.25, 0.5, 1, 2, 4])
      for (const [w, h] of SIZES) {
        const place = retiredDeletePlacement(layoutOf(w, h), w, h, zoom);
        if (!place) continue;
        shown += 1;
        for (const pad of pads(w * zoom, h * zoom))
          expect(overlaps(binRect(place), pad), `${w}x${h} at ${zoom}`).toBe(false);
      }
    expect(shown).toBeGreaterThan(0);
  });

  it('is hidden where there is no room: on a small card, or where it would sit on the words', () => {
    expect(retiredDeletePlacement(layoutOf(40, 30), 40, 30, 1)).toBeNull();
    expect(retiredDeletePlacement(layoutOf(0, 0), 0, 0, 1)).toBeNull();
    expect(wordsClearOfDelete(layoutOf(160, 80), 160, 1, 56)).toBe(false);
    // The face draws no button on a card too small to hold it.
    const { container } = render(
      <RetiredElementFace element={board({ width: 40, height: 30 })} onDelete={() => {}} />,
    );
    expect(button(container)).toBeNull();
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

// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 2: a table as stored before #459
// part 2, with its cells, cell styles and a cell link, which nothing reads any more.
const storedTable = () =>
  ({
    id: 'tbl',
    type: 'table',
    x: 0,
    y: 0,
    width: 360,
    height: 150,
    cells: [
      ['Owner', 'Status'],
      ['Sasha', 'Blocked'],
    ],
    cellStyles: [[{ bold: true }, { link: { kind: 'url', url: 'https://example.com' } }]],
    headerRow: true,
    tablePreset: 'table-banded',
  }) as unknown as Element & { width: number; height: number };

function faceProps(element: Element, readOnly: boolean, onDeleteRetired?: (id: string) => void) {
  return {
    element,
    isEditing: false,
    isSelected: true,
    readOnly,
    fontFamily: undefined,
    onDeleteRetired,
  } as unknown as Parameters<typeof ElementFaceRouter>[0];
}

describe('a stored table', () => {
  it('draws as the placeholder named Table, never its cells', () => {
    const { container } = render(<ElementFaceRouter {...faceProps(storedTable(), false)} />);
    const svg = container.querySelector('svg[data-retired-element="table"]')!;
    expect(svg).not.toBeNull();
    expect(lines(svg)).toEqual([
      ['name', 'Table'],
      ['note', RETIRED_ELEMENT_NOTE],
    ]);
    expect(container.textContent).not.toContain('Blocked');
    expect(container.querySelector('textarea, input, [contenteditable]')).toBeNull();
  });

  it('offers Delete to an Editor, and nothing to a read-only surface', () => {
    const onDeleteRetired = vi.fn();
    const editable = render(
      <ElementFaceRouter {...faceProps(storedTable(), false, onDeleteRetired)} />,
    );
    fireEvent.click(editable.container.querySelector('button[data-retired-delete]')!);
    expect(onDeleteRetired).toHaveBeenCalledWith('tbl');
    cleanup();
    const readOnly = render(
      <ElementFaceRouter {...faceProps(storedTable(), true, onDeleteRetired)} />,
    );
    expect(readOnly.container.querySelector('button')).toBeNull();
  });

  it('an Editor may delete it; a Viewer and a Participant who did not place it may not', () => {
    const editor = resolveEditorCapabilities({ level: 'edit', adderKey: null });
    const viewer = resolveEditorCapabilities({ level: 'view', adderKey: 'a'.repeat(32) });
    const participant = resolveEditorCapabilities({
      level: 'participate',
      adderKey: 'b'.repeat(32),
    });
    expect([editor, viewer, participant].map((can) => can.remove(storedTable()))).toEqual([
      true,
      false,
      false,
    ]);
    let after: Element[] | null = null;
    const table = storedTable();
    const actions = buildSelectionActions({
      currentSelectionIds: () => new Set<string>(),
      readSelection: () => ({ selectedId: null, multiSelectedIds: new Set<string>() }),
      activeTab: { id: 't', name: 'T', elements: [table] },
      commit: (map) => {
        after = map([table]);
      },
      setSelectedId: () => {},
      setEditingId: () => {},
      setMultiSelectedIds: () => {},
      setFormatSourceId: () => {},
      lockedByOther: () => false,
    });
    actions.deleteElementById('tbl');
    expect(after).toEqual([]);
  });
});

// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3: the layout containers, each as
// stored before the part, with fields only the deleted code knew.
const PART_3: [string, string, Record<string, unknown>][] = [
  ['lane', 'Lane', { titleOrientation: 'upright', laneEdge: 'left' }],
  ['stack', 'Stack', { stackDirection: 'vertical', stackGap: 12 }],
  ['boundary', 'Boundary', { boundaryStyle: 'c4' }],
  ['timeline-rail', 'Timeline', { timelineItems: [{ id: 'm1', label: 'Beta' }] }],
  ['diagram-key', 'Diagram Key', { keyRows: [{ id: 'k1', label: 'Service' }] }],
  ['card', 'Card', { cardHeader: true, headerFill: '#ff0000' }],
  ['callout', 'Callout', { calloutTone: 'warning' }],
  ['badge', 'Badge', { attachedTo: 'host', attachAt: 'top-right' }],
  ['step', 'Step Number', { attachedTo: 'host', attachAt: 'top-left' }],
  ['pointer-note', 'Pointer Note', { pointerTip: { x: 400, y: 300 } }],
];

const storedPart3 = (shape: string, fields: Record<string, unknown>) =>
  ({
    id: `p3-${shape}`,
    type: 'shape',
    shape,
    x: 0,
    y: 0,
    width: 280,
    height: 160,
    label: 'Checkout',
    ...fields,
  }) as unknown as ShapeElement;

describe('a stored layout container', () => {
  it.each(PART_3)(
    'draws a stored %s as the placeholder named %s, with its label',
    (kind, name, fields) => {
      const { container } = render(
        <ElementFaceRouter {...faceProps(storedPart3(kind, fields), false)} />,
      );
      const svg = container.querySelector(`svg[data-retired-element="${kind}"]`)!;
      expect(svg).not.toBeNull();
      expect(lines(svg)).toEqual([
        ['name', name],
        ['note', RETIRED_ELEMENT_NOTE],
        ['label', 'Checkout'],
      ]);
      expect(container.querySelector('textarea, input, [contenteditable]')).toBeNull();
    },
  );

  it.each(PART_3)('lets an Editor delete a stored %s, and no one else', (kind, _name, fields) => {
    const el = storedPart3(kind, fields);
    const editor = resolveEditorCapabilities({ level: 'edit', adderKey: null });
    const viewer = resolveEditorCapabilities({ level: 'view', adderKey: 'a'.repeat(32) });
    const participant = resolveEditorCapabilities({
      level: 'participate',
      adderKey: 'b'.repeat(32),
    });
    expect([editor, viewer, participant].map((can) => can.remove(el))).toEqual([
      true,
      false,
      false,
    ]);
    const onDeleteRetired = vi.fn();
    const editable = render(<ElementFaceRouter {...faceProps(el, false, onDeleteRetired)} />);
    fireEvent.click(editable.container.querySelector('button[data-retired-delete]')!);
    expect(onDeleteRetired).toHaveBeenCalledWith(el.id);
    cleanup();
    const readOnly = render(<ElementFaceRouter {...faceProps(el, true, onDeleteRetired)} />);
    expect(readOnly.container.querySelector('button')).toBeNull();
  });
});

// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4: a pen stroke, a highlighter stroke,
// a path and an annotation, each as stored before the part, with the fields only the deleted code knew.
const BOX = { x: 0, y: 0, width: 240, height: 160 };
const PART_4: [string, string, () => Element][] = [
  [
    'pen stroke',
    'Drawing',
    () => storedFreehand('pen', BOX, { pressures: [0.2, 0.8], penWidth: 2 }),
  ],
  [
    'highlighter stroke',
    'Drawing',
    () => storedFreehand('marker', BOX, { pen: 'highlighter', penColour: 'yellow' }),
  ],
  [
    'path',
    'Path',
    () => storedPath('path', BOX, { closed: true, fillColor: '#ff0000', contours: [[]] }),
  ],
];

describe('a stored pen stroke, highlighter stroke and path', () => {
  it.each(PART_4)('draws a stored %s as the placeholder named %s', (_kind, name, make) => {
    const el = make();
    const { container } = render(<ElementFaceRouter {...faceProps(el, false)} />);
    const svg = container.querySelector(`svg[data-retired-element="${el.type}"]`)!;
    expect(svg).not.toBeNull();
    expect(lines(svg)[0]).toEqual(['name', name]);
    expect(
      container.querySelector('path[data-stroke-hit], textarea, input, [contenteditable]'),
    ).toBeNull();
  });

  it.each(PART_4)('lets an Editor delete a stored %s, and no one else', (_kind, _name, make) => {
    const el = make();
    const editor = resolveEditorCapabilities({ level: 'edit', adderKey: null });
    const viewer = resolveEditorCapabilities({ level: 'view', adderKey: 'a'.repeat(32) });
    const participant = resolveEditorCapabilities({
      level: 'participate',
      adderKey: 'b'.repeat(32),
    });
    expect([editor, viewer, participant].map((can) => can.remove(el))).toEqual([
      true,
      false,
      false,
    ]);
    const onDeleteRetired = vi.fn();
    const editable = render(<ElementFaceRouter {...faceProps(el, false, onDeleteRetired)} />);
    fireEvent.click(editable.container.querySelector('button[data-retired-delete]')!);
    expect(onDeleteRetired).toHaveBeenCalledWith(el.id);
    cleanup();
    const readOnly = render(<ElementFaceRouter {...faceProps(el, true, onDeleteRetired)} />);
    expect(readOnly.container.querySelector('button')).toBeNull();
  });
});

// An annotation's 44 by 44 marker is too small for the Delete button: an Editor selects it and uses the toolbar's
// Delete, the ordinary removal.
describe('a stored annotation', () => {
  const note = () =>
    storedAnnotation('note', { x: 10, y: 10, width: 44, height: 44 }, { note: 'Check' });

  it('draws as the placeholder with no Delete button, even for an Editor', () => {
    const { container } = render(<ElementFaceRouter {...faceProps(note(), false, vi.fn())} />);
    expect(container.querySelector('svg[data-retired-element="annotation"]')).not.toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  it('an Editor removes it through the ordinary delete; a Viewer and a Participant may not', () => {
    const el = note();
    const editor = resolveEditorCapabilities({ level: 'edit', adderKey: null });
    const viewer = resolveEditorCapabilities({ level: 'view', adderKey: 'a'.repeat(32) });
    const participant = resolveEditorCapabilities({
      level: 'participate',
      adderKey: 'b'.repeat(32),
    });
    expect([editor, viewer, participant].map((can) => can.remove(el))).toEqual([
      true,
      false,
      false,
    ]);
    let after: Element[] | null = null;
    const actions = buildSelectionActions({
      currentSelectionIds: () => new Set(['note']),
      readSelection: () => ({ selectedId: 'note', multiSelectedIds: new Set<string>() }),
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
});

// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 5: the diagram shapes, each as stored
// before the part, named as their palette tiles named them (DEFAULTS.md D29), with fields only the deleted code knew.
const PART_5: [string, string][] = [
  ['square', 'Square'],
  ['circle', 'Circle'],
  ['diamond', 'Diamond'],
  ['cylinder', 'Cylinder'],
  ['parallelogram', 'Parallelogram'],
  ['hexagon', 'Hexagon'],
  ['document', 'Document'],
  ['stadium', 'Stadium'],
  ['actor', 'Actor'],
  ['final-state', 'Final State'],
  ['cloud', 'Cloud'],
  ['triangle', 'Triangle'],
  ['trapezoid', 'Trapezoid'],
  ['star', 'Star'],
  ['speech-bubble', 'Speech Bubble'],
];

const storedPart5 = (shape: string) =>
  ({
    id: `p5-${shape}`,
    type: 'shape',
    shape,
    x: 0,
    y: 0,
    width: 280,
    height: 160,
    label: 'Checkout',
    borderRadius: 'lg',
    accentEdge: 'left',
    iconId: 'cloud',
  }) as unknown as ShapeElement;

describe('a stored diagram shape', () => {
  it.each(PART_5)('draws a stored %s as the placeholder named %s, with its label', (kind, name) => {
    const { container } = render(<ElementFaceRouter {...faceProps(storedPart5(kind), false)} />);
    const svg = container.querySelector(`svg[data-retired-element="${kind}"]`)!;
    expect(svg).not.toBeNull();
    expect(lines(svg)).toEqual([
      ['name', name],
      ['note', RETIRED_ELEMENT_NOTE],
      ['label', 'Checkout'],
    ]);
    expect(container.querySelector('textarea, input, [contenteditable]')).toBeNull();
  });

  it.each(PART_5)('lets an Editor delete a stored %s, and no one else', (kind) => {
    const el = storedPart5(kind);
    const editor = resolveEditorCapabilities({ level: 'edit', adderKey: null });
    const viewer = resolveEditorCapabilities({ level: 'view', adderKey: 'a'.repeat(32) });
    const participant = resolveEditorCapabilities({
      level: 'participate',
      adderKey: 'b'.repeat(32),
    });
    expect([editor, viewer, participant].map((can) => can.remove(el))).toEqual([
      true,
      false,
      false,
    ]);
    const onDeleteRetired = vi.fn();
    const editable = render(<ElementFaceRouter {...faceProps(el, false, onDeleteRetired)} />);
    fireEvent.click(editable.container.querySelector('button[data-retired-delete]')!);
    expect(onDeleteRetired).toHaveBeenCalledWith(el.id);
    cleanup();
    const readOnly = render(<ElementFaceRouter {...faceProps(el, true, onDeleteRetired)} />);
    expect(readOnly.container.querySelector('button')).toBeNull();
  });
});
