import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PALETTE_DND_MIME, STICKER_DND_MIME } from '@/lib/icons';
import { setPaletteDragPreview } from '@/lib/palette-drag-preview';
import { tileDragStart } from './palette-tile-drag';

vi.mock('@/lib/palette-drag-preview', () => ({
  setPaletteDragPreview: vi.fn(),
  suppressNativeDragImage: vi.fn(),
}));

// A DataTransfer stand-in that records what the drag carries.
function fakeDrag() {
  const data = new Map<string, string>();
  const dataTransfer = {
    effectAllowed: 'uninitialized',
    setData: (type: string, value: string) => data.set(type, value),
  };
  return { event: { dataTransfer } as unknown as React.DragEvent, data, dataTransfer };
}

function drag(action: Parameters<typeof tileDragStart>[0]) {
  const start = tileDragStart(action);
  expect(start).toBeDefined();
  const d = fakeDrag();
  start!(d.event);
  return d;
}

describe('tileDragStart', () => {
  beforeEach(() => vi.mocked(setPaletteDragPreview).mockClear());

  it('carries a shape kind and publishes its footprint for the ghost', () => {
    const { data, dataTransfer } = drag({ type: 'shape', kind: 'speech-bubble' });
    expect(data.get(PALETTE_DND_MIME)).toBe('speech-bubble');
    expect(dataTransfer.effectAllowed).toBe('copy');
    expect(setPaletteDragPreview).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'speech-bubble' }),
    );
  });

  it('carries a shape’s creation-time choice alongside its kind', () => {
    const { data } = drag({ type: 'shape', kind: 'mode-button', mode: 'avatar' });
    expect(data.get(PALETTE_DND_MIME)).toBe('mode-button|avatar');
  });

  it('publishes a preset at its own size with its variant (office.md "Room presets")', () => {
    const { data } = drag({ type: 'shape', kind: 'room', variant: 'boardroom' });
    expect(data.get(PALETTE_DND_MIME)).toBe('room|boardroom');
    expect(setPaletteDragPreview).toHaveBeenCalledWith({
      kind: 'room',
      width: 800,
      height: 400,
      variant: 'boardroom',
    });
  });

  it('carries a sticky note', () => {
    expect(drag({ type: 'sticky' }).data.get(PALETTE_DND_MIME)).toBe('sticky');
  });

  it('carries a sticker on its own mime, never the shape one', () => {
    const { data } = drag({ type: 'sticker', stickerId: 'speech-balloon' });
    expect(data.get(STICKER_DND_MIME)).toBe('speech-balloon');
    expect(data.has(PALETTE_DND_MIME)).toBe(false);
  });

  it('offers no drag for a tool that arms a gesture rather than placing an element', () => {
    expect(tileDragStart({ type: 'text' })).toBeUndefined();
  });
});
