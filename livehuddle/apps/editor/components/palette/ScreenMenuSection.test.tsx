// @vitest-environment jsdom

// The Screen's section in the element menu (docs/specs/009-elements/screen-and-room-sign.md "Choosing what it shows"):
// what it shows now, Choose (Show on the Screen, on that source) and Clear.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livehuddle/document';
import { closeScreenPicker, screenPickerOpen } from '@/lib/office/screen-picker-store';
import { ScreenMenuSection } from './ScreenMenuSection';

afterEach(() => {
  cleanup();
  act(() => closeScreenPicker());
});

function show(over: Partial<ShapeElement> = {}) {
  const onSet = vi.fn();
  const onCloseMenu = vi.fn();
  const target = { ...createShape('screen', 0, 0), id: 's1', ...over } as ShapeElement;
  render(
    <ScreenMenuSection
      target={target}
      sectionProps={() => ({ open: true, onToggle: () => {} })}
      onSetScreenSource={onSet}
      onCloseMenu={onCloseMenu}
    />,
  );
  return { onSet, onCloseMenu };
}

describe('ScreenMenuSection', () => {
  it('says nothing is chosen, opens Show on the Screen on File and closes the menu', () => {
    const { onSet, onCloseMenu } = show();
    expect(screen.getByText('Nothing chosen')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Clear' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Choose' }));
    expect(screenPickerOpen()).toEqual({ elementId: 's1', tab: 'file' });
    expect(onCloseMenu).toHaveBeenCalledTimes(1);
    expect(onSet).not.toHaveBeenCalled();
  });

  it('names a file with its app and tab, and Change opens on File', () => {
    show({
      liveItem: { app: 'liveplanner', itemId: 'P1' },
      liveName: 'Launch Plan',
      liveTab: { id: 't2', name: 'Roadmap' },
    });
    expect(screen.getByText('Launch Plan')).toBeTruthy();
    expect(screen.getByText('liveplanner · Roadmap')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screenPickerOpen()).toEqual({ elementId: 's1', tab: 'file' });
  });

  it('names a video, opens on Video, and clears it', () => {
    const { onSet } = show({ screenUrl: 'https://vimeo.com/76979871' });
    expect(screen.getByText(/Vimeo/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screenPickerOpen()).toEqual({ elementId: 's1', tab: 'video' });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onSet).toHaveBeenCalledWith({ kind: 'none' });
  });
});
