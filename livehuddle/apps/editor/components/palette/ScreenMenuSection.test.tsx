// @vitest-environment jsdom

// The Screen's section in the element menu (docs/specs/009-elements/screen-and-room-sign.md "Screen"): its Video Link.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livehuddle/document';
import { ScreenMenuSection } from './ScreenMenuSection';

afterEach(cleanup);

function show(over: Partial<ShapeElement> = {}) {
  const onSetScreenUrl = vi.fn();
  render(
    <ScreenMenuSection
      target={{ ...createShape('screen', 0, 0), ...over }}
      sectionProps={() => ({ open: true, onToggle: () => {} })}
      onSetScreenUrl={onSetScreenUrl}
    />,
  );
  return onSetScreenUrl;
}

describe('ScreenMenuSection', () => {
  it('sets a video link, normalising a bare address', () => {
    const onSet = show();
    fireEvent.change(screen.getByLabelText('Video Link'), {
      target: { value: 'youtu.be/dQw4w9WgXcQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set' }));
    expect(onSet).toHaveBeenCalledWith('https://youtu.be/dQw4w9WgXcQ');
  });

  it('refuses a link that is not a video, and saves nothing', () => {
    const onSet = show();
    fireEvent.change(screen.getByLabelText('Video Link'), {
      target: { value: 'https://example.com' },
    });
    fireEvent.keyDown(screen.getByLabelText('Video Link'), { key: 'Enter' });
    expect(screen.getByRole('alert').textContent).toBe("That isn't a video link");
    expect(onSet).not.toHaveBeenCalled();
  });

  it('clears a saved link', () => {
    const onSet = show({ screenUrl: 'https://vimeo.com/76979871' });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onSet).toHaveBeenCalledWith(undefined);
  });
});
