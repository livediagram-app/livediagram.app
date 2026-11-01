// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livedesign/design';
import { EditorContext } from '@/app/design/[id]/EditorContext';
import type { PendingDraw } from '@/lib/draw-mode';
import { useEditorPaintBucket } from './useEditorPaintBucket';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const info = vi.fn();
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => ({ info }) }));

// docs/specs/023-draw-mode/drawing-tools.md "The Fill tool": the press bound to the editor around
// the canvas, and every reason it fills nothing.
const FILL: PendingDraw = { type: 'fill', fill: '#dbeafe' };
const square = {
  ...createShape('square', 0, 0),
  id: 'sq',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  fillColor: 'transparent',
} as Element;

function editor(over: Record<string, unknown> = {}) {
  return {
    activeTab: { elements: [square] },
    layers: undefined,
    layerInertIds: new Set<string>(),
    activeTabLocked: false,
    isReadOnly: false,
    activeTabLoadState: 'ready',
    can: { recolour: () => true },
    commitElements: vi.fn(),
    ...over,
  };
}

function press(ctx: ReturnType<typeof editor> | null, pendingDraw: PendingDraw | null = FILL) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <EditorContext.Provider value={ctx as never}>{children}</EditorContext.Provider>
  );
  const { result } = renderHook(() => useEditorPaintBucket(pendingDraw), { wrapper });
  result.current({ x: 50, y: 50 });
}

afterEach(() => info.mockClear());

describe('useEditorPaintBucket', () => {
  it('fills through the editor’s commit', () => {
    const ctx = editor();
    press(ctx);
    expect(ctx.commitElements).toHaveBeenCalledTimes(1);
    const map = vi.mocked(ctx.commitElements).mock.calls[0]![0] as (e: Element[]) => Element[];
    expect(map([square])[0]).toMatchObject({ fillColor: '#dbeafe' });
  });

  it('hints through the toast on the bare page', () => {
    const ctx = editor({ activeTab: { elements: [] } });
    press(ctx);
    expect(info).toHaveBeenCalledTimes(1);
  });

  it('fills nothing on a locked, read-only or unloaded tab, for a session that may not recolour, or outside an editor', () => {
    for (const over of [
      { activeTabLocked: true },
      { isReadOnly: true },
      { activeTabLoadState: 'loading' },
      { can: { recolour: () => false } },
    ]) {
      const ctx = editor(over);
      press(ctx);
      expect(ctx.commitElements).not.toHaveBeenCalled();
    }
    expect(() => press(null)).not.toThrow();
    const ctx = editor();
    press(ctx, null);
    expect(ctx.commitElements).not.toHaveBeenCalled();
  });
});
