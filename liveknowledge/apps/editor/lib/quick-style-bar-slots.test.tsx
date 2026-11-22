// @vitest-environment jsdom
// The Quick Style bar's slots and rooms (docs/specs/008-canvas/quick-style-panel.md "Where it sits").
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearQuickStyleBarSlot,
  setQuickStyleBarRoom,
  setQuickStyleBarSlot,
  useQuickStyleBarRoom,
  useQuickStyleBarSlot,
} from './quick-style-bar-slots';
import { QuickStyleBarSlot } from '@/components/canvas/QuickStyleBarSlot';

afterEach(() => cleanup());

function Probe({ pageId, seen }: { pageId: string | null; seen: unknown[] }) {
  seen.push(useQuickStyleBarSlot(pageId));
  return null;
}

describe('quick-style-bar-slots', () => {
  it("registers a page's slot from its row, with whether its title bar is named, and drops it as it goes", () => {
    const seen: unknown[] = [];
    const { rerender, unmount } = render(
      <>
        <QuickStyleBarSlot pageId="p" named />
        <Probe pageId="p" seen={seen} />
      </>,
    );
    const slot = seen.at(-1) as { el: HTMLElement; named: boolean };
    expect(slot.el.dataset.quickStyleBarSlot).toBe('');
    expect(slot.named).toBe(true);
    rerender(
      <>
        <QuickStyleBarSlot pageId="p" named={false} />
        <Probe pageId="p" seen={seen} />
      </>,
    );
    expect((seen.at(-1) as { named: boolean }).named).toBe(false);
    rerender(<Probe pageId="p" seen={seen} />);
    expect(seen.at(-1)).toBeNull();
    unmount();
  });

  it('gives no slot for no page', () => {
    const seen: unknown[] = [];
    render(<Probe pageId={null} seen={seen} />);
    expect(seen.at(-1)).toBeNull();
  });

  it("never drops a newer slot on an older one's cleanup", () => {
    const seen: unknown[] = [];
    const a = document.createElement('div');
    const b = document.createElement('div');
    render(<Probe pageId="q" seen={seen} />);
    act(() => {
      setQuickStyleBarSlot('q', { el: a, named: true });
      setQuickStyleBarSlot('q', { el: b, named: true });
      clearQuickStyleBarSlot('q', a);
    });
    expect((seen.at(-1) as { el: HTMLElement }).el).toBe(b);
    act(() => clearQuickStyleBarSlot('q', b));
    expect(seen.at(-1)).toBeNull();
  });

  it('keeps a room per page, rounded, never below 0', () => {
    const seen: number[] = [];
    const room = () => seen.at(-1);
    function Room() {
      seen.push(useQuickStyleBarRoom('r'));
      return null;
    }
    render(<Room />);
    expect(room()).toBe(0);
    act(() => setQuickStyleBarRoom('r', 120.4));
    expect(room()).toBe(120);
    act(() => setQuickStyleBarRoom('r', -5));
    expect(room()).toBe(0);
  });
});
