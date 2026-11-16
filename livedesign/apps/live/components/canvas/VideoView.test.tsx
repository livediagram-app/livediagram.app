// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVideo, type VideoElement } from '@livedesign/design';
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

// A live embed (liveworkspace/docs/specs/004-index/live-embeds.md "Making one"): only an Editor of this file, who may
// set an embed's link here, is asked to choose its file; a Participant or Viewer is told none is chosen, and nothing
// is framed before the element is on screen.
describe('VideoView as a live embed, by role', () => {
  const live = (): VideoElement => ({ ...createVideo(0, 0, 'live') });

  it('asks an Editor to choose a file', () => {
    render(<VideoView element={live()} canChoose />);
    expect(screen.getByText('Double-click to choose a file')).toBeTruthy();
  });

  it.each(['Participant', 'Viewer'])('tells a %s no file is chosen, offering no choice', () => {
    const { container } = render(<VideoView element={live()} canChoose={false} />);
    expect(screen.getByText('No file chosen yet')).toBeTruthy();
    expect(screen.queryByText('Double-click to choose a file')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('shows a chosen file as its snapshot and name, never a frame off screen', () => {
    const { container } = render(
      <VideoView
        element={{ ...live(), liveItem: { app: 'liveplanner', itemId: 'p1' }, liveName: 'Roadmap' }}
      />,
    );
    expect(screen.getByText('Roadmap')).toBeTruthy();
    expect(container.querySelector('iframe')).toBeNull();
  });
});
