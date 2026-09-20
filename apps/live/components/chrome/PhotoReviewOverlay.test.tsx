// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DetectedSticky } from '@livediagram/sticky-vision';
import type { PhotoReview } from '@/hooks/canvas/usePhotoDraft';
import { PhotoReviewOverlay } from './PhotoReviewOverlay';

// The review overlay opens BEFORE the detector has answered (spec/139 Phase
// 9): the photograph is on screen first, and the boxes arrive into it.
// Everything here is about that gap being handled honestly.

afterEach(cleanup);

const sticky = (id: number): DetectedSticky => ({
  id,
  kind: 'domain-event',
  size: 'square',
  x: 10,
  y: 10,
  w: 50,
  h: 50,
  row: 0,
  order: id,
  confidence: 0.9,
});

function review(over: Partial<PhotoReview> = {}): PhotoReview {
  return {
    photoUrl: 'blob:the-photo',
    detection: null,
    textById: new Map(),
    readError: null,
    ...over,
  };
}

function found(stickies: DetectedSticky[]): PhotoReview['detection'] {
  return {
    stickies,
    crops: [],
    imageSize: { width: 100, height: 100 },
    photoUrl: 'data:image/jpeg;base64,xx',
    imageData: new Uint8ClampedArray(100 * 100 * 4),
  };
}

const noop = () => {};

describe('while the detector is still looking', () => {
  it('shows the photograph the author picked, and says what it is doing', () => {
    render(
      <PhotoReviewOverlay review={review()} reading={false} onConfirm={noop} onCancel={noop} />,
    );
    expect(screen.getByAltText('The photographed wall').getAttribute('src')).toBe('blob:the-photo');
    expect(screen.getAllByText(/finding the stickies/i).length).toBeGreaterThan(0);
    // Nothing to add yet, and no way to add nothing.
    expect(
      (screen.getByRole('button', { name: /^Add 0 notes$/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('offers the retake advice when the detector found nothing', () => {
    render(
      <PhotoReviewOverlay
        review={review({ detection: found([]) })}
        reading={false}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(screen.queryAllByText(/finding the stickies/i)).toEqual([]);
    expect(screen.getByText(/no stickies found in this photo/i)).toBeTruthy();
    // The photo stays up: the advice is about THIS photograph.
    expect(screen.getByAltText('The photographed wall')).toBeTruthy();
  });
});

describe('when the detection arrives', () => {
  it('ticks every box it found, so Add is ready without a click', () => {
    // The regression this pins: the overlay mounts with NO detection, so a
    // ticked-set seeded once at mount stays empty forever and the button reads
    // "Add 0 notes" over a wall full of boxes.
    const { rerender } = render(
      <PhotoReviewOverlay review={review()} reading={false} onConfirm={noop} onCancel={noop} />,
    );
    rerender(
      <PhotoReviewOverlay
        review={review({ detection: found([sticky(0), sticky(1), sticky(2)]) })}
        reading={false}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(
      (screen.getByRole('button', { name: /^Add 3 notes$/ }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('hands the ticked boxes to the caller on Add', () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <PhotoReviewOverlay
        review={review()}
        reading={false}
        onConfirm={onConfirm}
        onCancel={noop}
      />,
    );
    rerender(
      <PhotoReviewOverlay
        review={review({ detection: found([sticky(0), sticky(1)]) })}
        reading={false}
        onConfirm={onConfirm}
        onCancel={noop}
      />,
    );
    screen.getByRole('button', { name: /^Add 2 notes$/ }).click();
    expect(onConfirm).toHaveBeenCalled();
    expect([...(onConfirm.mock.calls[0]![0] as Set<number>)]).toEqual([0, 1]);
  });
});
