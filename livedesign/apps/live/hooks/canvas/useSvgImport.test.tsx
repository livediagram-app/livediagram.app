// @vitest-environment jsdom
// docs/specs/020-import-export/svg-import.md: an SVG lands on the page as selected path elements in one commit; a
// file too big for shapes is placed as a picture; drop and paste say how it went in a toast, the dialog gets the
// report; a read-only or blocked canvas takes nothing.
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { layOutPages, MAX_ELEMENTS_PER_TAB, type Element, type Page } from '@livedesign/design';
import {
  SVG_NOTHING_TO_IMPORT,
  SVG_PICTURE_FALLBACK,
  SVG_UNREADABLE,
  useSvgImport,
} from './useSvgImport';

const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track, titleCaseType: (s: string) => s }));

const pages = layOutPages([{ id: 'p1', size: 'logo' } as Page]);
const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`;
const TWO = svg(
  '<rect width="10" height="10" fill="red"/><circle cx="50" cy="50" r="20"/><text>Hi</text>',
);

function harness(over: { isReadOnly?: boolean; blocked?: boolean; elementCount?: number } = {}) {
  let elements: Element[] = [];
  const toast = { info: vi.fn(), error: vi.fn() };
  const setSelectedId = vi.fn();
  const setMultiSelectedIds = vi.fn();
  const refuseCreate = vi.fn(() => over.blocked === true);
  const { result } = renderHook(() =>
    useSvgImport({
      refuseCreate,
      isReadOnly: over.isReadOnly ?? false,
      elementCount: over.elementCount ?? 0,
      pages,
      getViewportCanvasRect: () => null,
      commit: (m) => {
        elements = m(elements);
      },
      setSelectedId,
      setMultiSelectedIds,
      toast: toast as never,
    }),
  );
  return {
    result,
    elements: () => elements,
    toast,
    setSelectedId,
    setMultiSelectedIds,
    refuseCreate,
  };
}

describe('useSvgImport', () => {
  it('commits every path at once, selects them and toasts the report on a drop', async () => {
    const h = harness();
    expect(await h.result.current.importSvg(TWO, 'drop')).toEqual({ status: 'done' });
    expect(h.elements()).toHaveLength(2);
    expect(h.elements().every((el) => el.type === 'path')).toBe(true);
    const ids = h.setMultiSelectedIds.mock.calls[0]![0] as Set<string>;
    expect([...ids]).toEqual(h.elements().map((el) => el.id));
    expect(h.toast.info).toHaveBeenCalledWith(
      'Brought in 2 shapes. 1 text element was left out. Outline the text before exporting, or retype it.',
    );
    expect(track).toHaveBeenCalledWith('Tab', 'Imported', 'Svg');
    // Every shape lands inside the page.
    const r = pages[0]!.rect;
    for (const el of h.elements() as { x: number; y: number }[]) {
      expect(el.x).toBeGreaterThanOrEqual(r.x);
      expect(el.y).toBeGreaterThanOrEqual(r.y);
    }
  });

  it('selects a single shape on its own and hands the dialog its report', async () => {
    const h = harness();
    const out = await h.result.current.importSvg(
      svg('<rect width="1" height="1"/><text>a</text>'),
      'dialog',
    );
    expect(out).toEqual({ status: 'done', failures: [expect.objectContaining({ title: 'Text' })] });
    expect(h.setSelectedId).toHaveBeenCalledWith(h.elements()[0]!.id);
    expect(h.toast.info).not.toHaveBeenCalled();
  });

  it('places a file too big for shapes as a picture, never reading one past the cap', async () => {
    const h = harness();
    const placePicture = vi.fn();
    const big = new File(['x'.repeat(10)], 'big.svg', { type: 'image/svg+xml' });
    Object.defineProperty(big, 'size', { value: 3 * 1024 * 1024 });
    await h.result.current.importSvg('', 'drop', { file: big, placePicture, at: { x: 1, y: 2 } });
    expect(placePicture).toHaveBeenCalledWith(big, { x: 1, y: 2 });
    expect(h.toast.info).toHaveBeenCalledWith(SVG_PICTURE_FALLBACK);
    // Too many elements: placed from the text, in the middle of the page's safe area.
    const many = svg('<rect width="1" height="1"/>'.repeat(5_001));
    await h.result.current.importSvg(many, 'paste', { placePicture });
    const [file, at] = placePicture.mock.calls[1]!;
    expect((file as File).type).toBe('image/svg+xml');
    expect(at).toEqual({ x: pages[0]!.rect.x + pages[0]!.rect.width / 2, y: expect.any(Number) });
    expect(h.elements()).toHaveLength(0);
  });

  it('places a picture when the tab has no room for the shapes', async () => {
    const h = harness({ elementCount: MAX_ELEMENTS_PER_TAB });
    const placePicture = vi.fn();
    await h.result.current.importSvg(TWO, 'drop', { placePicture });
    expect(placePicture).toHaveBeenCalledTimes(1);
    expect(h.elements()).toHaveLength(0);
  });

  it('says why when the file cannot be read, holds nothing, or has no picture route', async () => {
    const h = harness();
    expect(await h.result.current.importSvg('nope', 'dialog')).toEqual({
      status: 'error',
      error: SVG_UNREADABLE,
    });
    await h.result.current.importSvg('nope', 'paste');
    expect(h.toast.info).toHaveBeenLastCalledWith(SVG_UNREADABLE);
    const words = await h.result.current.importSvg(svg('<text>a</text>'), 'dialog');
    expect(words).toEqual({
      status: 'error',
      error: expect.stringContaining(SVG_NOTHING_TO_IMPORT),
    });
    expect(await h.result.current.importSvg(svg('<path d="M0 0"/>'), 'dialog')).toEqual({
      status: 'error',
      error: SVG_NOTHING_TO_IMPORT,
    });
    const many = svg('<rect width="1" height="1"/>'.repeat(5_001));
    expect(await h.result.current.importSvg(many, 'dialog')).toEqual({
      status: 'error',
      error: SVG_UNREADABLE,
    });
  });

  it('takes nothing on a read-only or blocked canvas', async () => {
    const ro = harness({ isReadOnly: true });
    expect(await ro.result.current.importSvg(TWO, 'drop')).toEqual({ status: 'cancelled' });
    const blocked = harness({ blocked: true });
    expect(await blocked.result.current.importSvg(TWO, 'paste')).toEqual({ status: 'cancelled' });
    expect(blocked.refuseCreate).toHaveBeenCalled();
    expect(blocked.elements()).toHaveLength(0);
  });
});
