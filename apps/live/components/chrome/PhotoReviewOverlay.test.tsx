// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

describe('the words, on the note', () => {
  const withWords = (stickies: DetectedSticky[], words: [number, string][]) =>
    review({
      detection: found(stickies),
      textById: new Map(words.map(([id, text]) => [id, { text, legible: true }])),
    });

  it('shows what was read off each sticky, and never the kind name', () => {
    // The kind is already on the box, in its colour. The one thing the author
    // cannot see from across the photograph is what the reader made of the
    // handwriting, so that is what the box says.
    render(
      <PhotoReviewOverlay
        review={withWords(
          [sticky(0), sticky(1)],
          [
            [0, 'Order placed'],
            [1, 'Payment taken'],
          ],
        )}
        reading={false}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByText('Order placed')).toBeTruthy();
    expect(screen.getByText('Payment taken')).toBeTruthy();
    expect(screen.queryByText(/domain event/i)).toBeNull();
  });

  it('says nothing yet, quietly, while the reader is still going', () => {
    render(
      <PhotoReviewOverlay
        review={review({ detection: found([sticky(0)]) })}
        reading
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(screen.queryByText(/domain event/i)).toBeNull();
    expect(screen.getByTestId('note-words-0').textContent).toBe('\u2026');
  });

  it('hands the edited words to the caller, edited in place on the photo', () => {
    const onConfirm = vi.fn();
    render(
      <PhotoReviewOverlay
        review={withWords([sticky(0)], [[0, 'Odor placed']])}
        reading={false}
        onConfirm={onConfirm}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByTestId('note-words-0'));
    const input = screen.getByDisplayValue('Odor placed') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Order placed' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    screen.getByRole('button', { name: /^Add 1 note$/ }).click();
    const texts = onConfirm.mock.calls[0]![1] as Map<number, { text: string }>;
    expect(texts.get(0)!.text).toBe('Order placed');
  });

  it('puts the words in the tick control’s name, so it can be told apart by ear', () => {
    render(
      <PhotoReviewOverlay
        review={withWords([sticky(0)], [[0, 'Order placed']])}
        reading={false}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByRole('checkbox', { name: /Order placed/ })).toBeTruthy();
  });

  it('leaves a note out when its tick is cleared', () => {
    const onConfirm = vi.fn();
    render(
      <PhotoReviewOverlay
        review={withWords(
          [sticky(0), sticky(1)],
          [
            [0, 'One'],
            [1, 'Two'],
          ],
        )}
        reading={false}
        onConfirm={onConfirm}
        onCancel={noop}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /One/ }));
    screen.getByRole('button', { name: /^Add 1 note$/ }).click();
    expect([...(onConfirm.mock.calls[0]![0] as Set<number>)]).toEqual([1]);
  });
});

describe('one surface, not a dialog with a list beside it', () => {
  it('keeps Escape as the way out', () => {
    const onCancel = vi.fn();
    render(
      <PhotoReviewOverlay
        review={review({ detection: found([sticky(0)]) })}
        reading={false}
        onConfirm={noop}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('has no list of notes beside the photo — one row of words per note, on it', () => {
    render(
      <PhotoReviewOverlay
        review={review({
          detection: found([sticky(0), sticky(1)]),
          textById: new Map([
            [0, { text: 'One', legible: true }],
            [1, { text: 'Two', legible: true }],
          ]),
        })}
        reading={false}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getAllByText('One')).toHaveLength(1);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });
});

describe('before the photograph itself has painted', () => {
  it('reserves the frame and says the photo is loading', () => {
    render(
      <PhotoReviewOverlay review={review()} reading={false} onConfirm={noop} onCancel={noop} />,
    );
    // The overlay must never be an empty box: the frame the photo will fill is
    // on screen from the first paint, with a skeleton in it, so the author can
    // see WHERE the photo is going while the browser decodes it.
    const frame = screen.getByTestId('photo-frame');
    expect(frame).toBeTruthy();
    expect(screen.getByTestId('photo-loading')).toBeTruthy();
  });

  it('drops the skeleton once the image has loaded', () => {
    render(
      <PhotoReviewOverlay review={review()} reading={false} onConfirm={noop} onCancel={noop} />,
    );
    fireEvent.load(screen.getByAltText('The photographed wall'));
    expect(screen.queryByTestId('photo-loading')).toBeNull();
  });
});
