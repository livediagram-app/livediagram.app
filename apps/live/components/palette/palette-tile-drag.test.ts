import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ICON_DND_MIME, PALETTE_DND_MIME } from '@/lib/icons';
import { STICKER_DND_MIME } from '@/lib/stickers';
import { TECH_ICON_DND_MIME } from '@/lib/tech-icons';
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
    const { data } = drag({ type: 'shape', kind: 'session-button', session: 'poll' });
    expect(data.get(PALETTE_DND_MIME)).toBe('session-button|poll');
  });

  it('carries a sticky note, with its event-storming kind when it has one', () => {
    expect(drag({ type: 'sticky' }).data.get(PALETTE_DND_MIME)).toBe('sticky');
    expect(drag({ type: 'sticky', esKind: 'command' }).data.get(PALETTE_DND_MIME)).toBe(
      'sticky|command',
    );
  });

  it('carries a line icon on the icon mime', () => {
    const { data } = drag({ type: 'icon', iconId: 'message' });
    expect(data.get(ICON_DND_MIME)).toBe('message');
    expect(data.has(PALETTE_DND_MIME)).toBe(false);
  });

  it('carries a technology icon on the tech-icon mime', () => {
    expect(drag({ type: 'tech-icon', iconId: 'react' }).data.get(TECH_ICON_DND_MIME)).toBe('react');
  });

  it('carries a sticker on its own mime, never the icon one', () => {
    const { data } = drag({ type: 'sticker', stickerId: 'speech-balloon' });
    expect(data.get(STICKER_DND_MIME)).toBe('speech-balloon');
    expect(data.has(ICON_DND_MIME)).toBe(false);
  });

  it('offers no drag for tools that arm a gesture rather than place an element', () => {
    for (const type of ['text', 'freehand', 'shape-pen', 'polygon', 'arrow'] as const) {
      expect(tileDragStart({ type })).toBeUndefined();
    }
  });
});
