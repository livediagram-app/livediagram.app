// @vitest-environment jsdom
// The Quick Style bar's slots and room (docs/specs/008-canvas/quick-style-panel.md "Where it sits").
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearQuickStyleBarSlot,
  setQuickStyleBarRoom,
  setQuickStyleBarSlot,
  setQuickStylePhoneRows,
  useQuickStyleBarRoom,
  useQuickStyleBarSlot,
  useQuickStylePhoneRows,
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
      setQuickStyleBarSlot('q', { el: a, named: true });
      setQuickStyleBarSlot('q', { el: b, named: true });
      clearQuickStyleBarSlot('q', a);
    });
    expect((seen.at(-1) as { el: HTMLElement }).el).toBe(b);
    act(() => clearQuickStyleBarSlot('q', b));
    expect(seen.at(-1)).toBeNull();
  });

  it('keeps the room beside one page, rounded, and gives it back only for that page', () => {
    const rooms: ReturnType<typeof useQuickStyleBarRoom>[] = [];
    function Room() {
      rooms.push(useQuickStyleBarRoom());
      return null;
    }
    render(<Room />);
    const roomOf = () => rooms.at(-1);
    expect(roomOf()).toBeNull();
    act(() => setQuickStyleBarRoom('r', 120.4));
    expect(roomOf()).toEqual({ pageId: 'r', px: 120 });
    const same = roomOf();
    act(() => setQuickStyleBarRoom('r', 120.2));
    expect(roomOf()).toBe(same);
    // The bar moving on: the old page's give-back never clears the new page's room.
    act(() => setQuickStyleBarRoom('s', 80));
    act(() => setQuickStyleBarRoom('r', 0));
    expect(roomOf()).toEqual({ pageId: 's', px: 80 });
    act(() => setQuickStyleBarRoom('s', -5));
    expect(roomOf()).toBeNull();
  });

  it("keeps a phone's rows for one page, and takes them back only for that page", () => {
    const phones: ReturnType<typeof useQuickStylePhoneRows>[] = [];
    function Phone() {
      phones.push(useQuickStylePhoneRows());
      return null;
    }
    render(<Phone />);
    expect(phones.at(-1)).toBeNull();
    const open = () => {};
    act(() => setQuickStylePhoneRows('a', { pageId: 'a', rows: [], open }));
    expect(phones.at(-1)!.pageId).toBe('a');
    act(() => setQuickStylePhoneRows('b', { pageId: 'b', rows: [], open }));
    act(() => setQuickStylePhoneRows('a', null));
    expect(phones.at(-1)!.pageId).toBe('b');
    act(() => setQuickStylePhoneRows('b', null));
    expect(phones.at(-1)).toBeNull();
  });
});
