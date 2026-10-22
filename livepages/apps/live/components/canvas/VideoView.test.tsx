// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVideo, type VideoElement } from '@livediagram/document';
import { VideoView } from './VideoView';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// A video (docs/specs/009-elements/youtube-video.md) mounts its player only on play, and a new link
// tears the player down rather than leaving the old video playing behind the new poster.

const video = (id: string): VideoElement => ({
  ...createVideo(0, 0),
  link: { kind: 'url', url: `https://www.youtube.com/watch?v=${id}` },
});

afterEach(cleanup);

describe('VideoView', () => {
  it('mounts the player only once play is pressed', () => {
    const { container } = render(<VideoView element={video('dQw4w9WgXcQ')} />);
    expect(container.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByLabelText('Play video'));
    expect(container.querySelector('iframe')).not.toBeNull();
  });

  it('stops the player when the link changes', () => {
    const { container, rerender } = render(<VideoView element={video('dQw4w9WgXcQ')} />);
    fireEvent.click(screen.getByLabelText('Play video'));
    act(() => rerender(<VideoView element={video('9bZkp7q19f0')} />));
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByLabelText('Play video')).toBeTruthy();
  });
});
