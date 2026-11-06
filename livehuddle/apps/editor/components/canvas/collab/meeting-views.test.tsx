// @vitest-environment jsdom

// The Screen's and the Room Sign's faces (docs/specs/009-elements/screen-and-room-sign.md), from the pieces' store.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livehuddle/document';
import { resetMeetingLive, setKnocker, setMeetingLive } from '@/lib/office/meeting-live';
import { ScreenView } from './ScreenView';
import { RoomSignView } from './RoomSignView';

afterEach(() => {
  cleanup();
  act(() => resetMeetingLive());
});

const el = (kind: 'screen' | 'room-sign', over: Partial<ShapeElement> = {}) =>
  ({ ...createShape(kind, 0, 0), id: 'p', ...over }) as ShapeElement;

describe('ScreenView', () => {
  it('rests with No one is sharing, and nothing to press', () => {
    render(<ScreenView element={el('screen')} />);
    expect(screen.getByRole('img', { name: 'Screen: No one is sharing' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows its video link, and opens a large player on a press', () => {
    const { container } = render(
      <ScreenView element={el('screen', { screenUrl: 'https://youtu.be/dQw4w9WgXcQ' })} />,
    );
    expect(container.querySelector('[data-screen-face="video"]')).toBeTruthy();
    expect(document.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play YouTube' }));
    expect(document.querySelector('[data-screen-player] iframe')?.getAttribute('src')).toContain(
      'youtube-nocookie.com',
    );
    // The bar's Close (the backdrop is a Close too).
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(document.querySelector('[data-screen-player]')).toBeNull();
  });
});

describe('RoomSignView', () => {
  it('reads Free with no Knock before any presence', () => {
    render(<RoomSignView element={el('room-sign')} />);
    expect(screen.getByRole('img', { name: 'Room: Free' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('reads In Use with count, and knocks once per window', () => {
    const knock = vi.fn();
    act(() => {
      setKnocker(knock);
      setMeetingLive(
        new Map([
          [
            'p',
            {
              roomId: 'r1',
              name: 'Kitchen',
              status: 'in-use',
              count: 3,
              since: Date.now(),
              selfInside: false,
            },
          ],
        ]),
      );
    });
    render(<RoomSignView element={el('room-sign')} />);
    expect(screen.getByRole('img', { name: 'Kitchen: In Use · 3 · Just now' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Knock on Kitchen' }));
    expect(knock).toHaveBeenCalledWith('r1');
  });

  it('reads Do Not Disturb for a shut pod, and offers no Knock to someone inside', () => {
    act(() => {
      setKnocker(() => {});
      setMeetingLive(
        new Map([
          [
            'p',
            {
              roomId: 'pod',
              name: 'Office Pod',
              status: 'dnd',
              count: 2,
              since: 1,
              selfInside: true,
            },
          ],
        ]),
      );
    });
    render(<RoomSignView element={el('room-sign')} />);
    expect(screen.getByRole('img', { name: 'Office Pod: Do Not Disturb' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
