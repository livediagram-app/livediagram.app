// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    photoName: 'wall.jpg',
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
    dropped: 0,
    detector: { path: 'classical', reason: 'no-worker' },
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

  it('marks each box with its kind and the overlay with the detector, for tools that score it', () => {
    render(
      <PhotoReviewOverlay
        review={review({ detection: found([sticky(0)]) })}
        reading={false}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByTestId('note-box-0').dataset.kind).toBe(sticky(0).kind);
    expect(screen.getByTestId('photo-review-overlay').dataset.detector).toBe('classical');
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
    expect((onConfirm.mock.calls[0]![0] as DetectedSticky[]).map((s) => s.id)).toEqual([0, 1]);
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
    expect((onConfirm.mock.calls[0]![0] as DetectedSticky[]).map((s) => s.id)).toEqual([1]);
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

describe('the reveal', () => {
  const shown = () =>
    screen.queryAllByTestId(/^note-box-/).filter((b) => b.dataset.shown === 'yes');

  const revealOf = (count: number) => {
    vi.useFakeTimers();
    const stickies = Array.from({ length: count }, (_, i) => sticky(i));
    render(
      <PhotoReviewOverlay
        review={review({ detection: found(stickies) })}
        reading={false}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    return {
      advance: (ms: number) => act(() => void vi.advanceTimersByTime(ms)),
      done: () => vi.useRealTimers(),
    };
  };

  it('keeps a small wall at two boxes a second, as it always did', () => {
    const clock = revealOf(6);
    clock.advance(1000);
    expect(shown()).toHaveLength(2);
    clock.advance(2000);
    expect(shown()).toHaveLength(6);
    clock.done();
  });

  it('fits a big wall into the same budget, spread evenly over every box', () => {
    // Recall tripled, and at a flat half-second a box a 54-note wall took
    // twenty-seven seconds to finish. The reveal is a flourish that says the
    // wall is being read, not a progress bar to sit through — so the whole of
    // it fits in one budget, with the boxes spread evenly across it rather
    // than a leisurely start and a sudden flush at the end.
    const clock = revealOf(60);
    clock.advance(3000);
    expect(shown().length).toBeGreaterThanOrEqual(25);
    expect(shown().length).toBeLessThanOrEqual(35);
    clock.advance(3200);
    expect(shown()).toHaveLength(60);
    clock.done();
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

// Exporting ground truth (docs/vision/sticky-detection.md). The corrected
// review IS a labelling of the photograph, and the detector is tuned against
// labelled photographs — so the work the author does here for real can be
// handed back as a file instead of being done twice.
describe('labelling a wall from the review', () => {
  const armed = () => localStorage.setItem('livediagram:truth', '1');
  afterEach(() => localStorage.clear());

  it('offers nothing to a normal author: this is a calibration tool', () => {
    // The suite runs on localhost, where labelling lives, so say plainly that
    // this browser is not one: the export is off wherever it is turned off.
    localStorage.setItem('livediagram:truth', '0');
    render(
      <PhotoReviewOverlay
        review={review({ detection: found([sticky(0)]), photoName: 'wall.jpg' })}
        reading={false}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(screen.queryByRole('button', { name: /save as truth/i })).toBeNull();
  });

  it('hands back the boxes the author LEFT ticked, as fractions of the photo', async () => {
    armed();
    const saved: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      saved.push(blob as Blob);
      return 'blob:truth';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    render(
      <PhotoReviewOverlay
        review={review({
          detection: found([sticky(0), sticky(1)]),
          photoName: 'wall.jpg',
          textById: new Map([[0, { text: 'Order placed', legible: true }]]),
        })}
        reading={false}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    // Untick the second: it was not a sticky, and a label must not claim it was.
    fireEvent.click(screen.getAllByRole('checkbox')[1]!);
    fireEvent.click(screen.getByRole('button', { name: /save as truth/i }));
    expect(saved).toHaveLength(1);
    const truth = JSON.parse(await saved[0]!.text()) as {
      photo: string;
      labelledOn: { width: number; height: number };
      notes: { x: number; y: number; w: number; h: number; kind: string; text?: string }[];
    };
    expect(truth.photo).toBe('wall');
    expect(truth.labelledOn).toEqual({ width: 100, height: 100 });
    // One note, because one was unticked — and in fractions, not pixels.
    // The words travel with the box: they are the reader's ground truth, and
    // where an author says something about a box.
    expect(truth.notes).toEqual([
      { x: 0.1, y: 0.1, w: 0.5, h: 0.5, kind: 'domain-event', text: 'Order placed' },
    ]);
    vi.restoreAllMocks();
  });
});

// Zooming into the photograph (spec/139 Phase 9). A wall of three hundred
// notes puts each sticky at about fifteen pixels when the whole photo fits the
// window, which is too small to judge, tick or draw round.
describe('zooming into the photo', () => {
  const picture = () => screen.getByTestId('photo-picture');
  const open = () =>
    render(
      <PhotoReviewOverlay
        review={review({ detection: found([sticky(0)]) })}
        reading={false}
        onConfirm={noop}
        onCancel={noop}
      />,
    );

  it('starts with the whole photo in view', () => {
    open();
    expect(picture().style.transform).toContain('scale(1)');
    expect(screen.getByTestId('photo-zoom-level').textContent).toBe('100%');
  });

  it('zooms in and back out from the controls', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByTestId('photo-zoom-level').textContent).toBe('150%');
    expect(picture().style.transform).toContain('scale(1.5)');
    fireEvent.click(screen.getByRole('button', { name: 'Show the whole photo' }));
    expect(screen.getByTestId('photo-zoom-level').textContent).toBe('100%');
  });

  it('zooms from the keyboard, but never while the words are being typed', () => {
    open();
    fireEvent.keyDown(window, { key: '+' });
    expect(screen.getByTestId('photo-zoom-level').textContent).toBe('150%');
    fireEvent.keyDown(window, { key: '0' });
    expect(screen.getByTestId('photo-zoom-level').textContent).toBe('100%');
    // Editing a note's words: "+" and "0" are characters, not commands.
    fireEvent.click(screen.getByTestId('note-words-0'));
    const input = screen.getByRole('textbox', { name: /the words on this note/i });
    fireEvent.keyDown(input, { key: '+' });
    expect(screen.getByTestId('photo-zoom-level').textContent).toBe('100%');
  });

  it('keeps the tick and the words the same size on screen at any zoom', () => {
    // Everything on the photo scales with it — except the controls on each
    // box, or at 400% a word pill is four times as big and covers the very
    // notes the zoom was for.
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    const tick = screen.getByRole('checkbox');
    expect(tick.style.transform).toBe(`scale(${1 / 2.25})`);
    expect(screen.getByTestId('note-words-0').style.transform).toBe(`scale(${1 / 2.25})`);
    // …and so does the outline: two pixels on screen, drawn as a shadow so the
    // browser cannot round it up to a whole pixel of PHOTO first.
    const outline = screen.getByTestId('note-box-0').firstElementChild as HTMLElement;
    expect(outline.style.boxShadow).toContain(`${2 / 2.25}px`);
    expect(outline.style.borderWidth).toBe('');
  });
});

// A wall with more notes than one photo may yield. The cut used to be silent,
// and it kept the first notes in READING order — so the right half of a big
// wall simply had no boxes on it, and nothing said why.
describe('a wall with more notes than the review holds', () => {
  it('says how many were left out, and what to do about it', () => {
    const detection = { ...found([sticky(0)])!, dropped: 37 };
    render(
      <PhotoReviewOverlay
        review={review({ detection })}
        reading={false}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByTestId('photo-dropped').textContent).toMatch(/37 more/);
  });

  it('says nothing when nothing was left out', () => {
    render(
      <PhotoReviewOverlay
        review={review({ detection: found([sticky(0)]) })}
        reading={false}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(screen.queryByTestId('photo-dropped')).toBeNull();
  });
});

// Correcting a box, not just unticking it (spec/139 Phase 9).
describe('correcting a box', () => {
  const open = (onConfirm = vi.fn(), onCancel = vi.fn()) => {
    render(
      <PhotoReviewOverlay
        review={review({ detection: found([sticky(0), { ...sticky(1), x: 60 }]) })}
        reading={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    return { onConfirm, onCancel };
  };
  const pick = (id: number) => fireEvent.pointerDown(screen.getByTestId(`note-body-${id}`));

  it('selects a box by its body, and offers to correct it', () => {
    open();
    expect(screen.queryByRole('toolbar', { name: /correct this box/i })).toBeNull();
    pick(1);
    expect(screen.getByTestId('note-box-1').dataset.selected).toBe('yes');
    expect(screen.getByRole('toolbar', { name: /correct this box/i })).toBeTruthy();
    expect(screen.getByTestId('box-handle-se')).toBeTruthy();
  });

  it('deletes the selected box, from its button or the Delete key', () => {
    const { onConfirm } = open();
    pick(1);
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(screen.queryByTestId('note-box-1')).toBeNull();
    pick(0);
    fireEvent.click(screen.getByRole('button', { name: 'Delete this box' }));
    expect(screen.queryByTestId('note-box-0')).toBeNull();
    // Nothing left to add.
    expect(
      (screen.getByRole('button', { name: /^Add 0 notes$/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('changes a box to another kind, and that is what lands', () => {
    const { onConfirm } = open();
    pick(0);
    fireEvent.click(screen.getByRole('button', { name: 'Make this a policy' }));
    fireEvent.click(screen.getByRole('button', { name: /^Add 2 notes$/ }));
    const kept = onConfirm.mock.calls[0]![0] as DetectedSticky[];
    expect(kept.find((s) => s.id === 0)).toMatchObject({ kind: 'policy', size: 'wide' });
  });

  it('lets go of a box on Escape, and only a second Escape leaves', () => {
    const { onCancel } = open();
    pick(0);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('note-box-0').dataset.selected).toBeUndefined();
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('never deletes a box while its words are being typed', () => {
    open();
    pick(0);
    fireEvent.click(screen.getByTestId('note-words-0'));
    const input = screen.getByRole('textbox', { name: /the words on this note/i });
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(screen.getByTestId('note-box-0')).toBeTruthy();
  });
});

// Reopening a saved label to correct it (spec/139 Phase 9).
describe('opening a saved label over the photo', () => {
  afterEach(() => localStorage.clear());
  const label = (photo: string) =>
    new File(
      [
        JSON.stringify({
          photo,
          labelledOn: { width: 100, height: 100 },
          notes: [
            { x: 0.2, y: 0.2, w: 0.1, h: 0.1, kind: 'command', text: 'Place order' },
            { x: 0.5, y: 0.5, w: 0.1, h: 0.1, kind: 'policy' },
          ],
        }),
      ],
      `${photo}.json`,
      { type: 'application/json' },
    );
  const open = () =>
    render(
      <PhotoReviewOverlay
        review={review({ detection: found([sticky(0)]), photoName: 'wall.jpg' })}
        reading={false}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
  const pickFile = async (file: File) => {
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Open a saved label'), {
        target: { files: [file] },
      });
      await new Promise((r) => setTimeout(r, 0));
    });
  };

  it('lays the labelled boxes and their words over the photo, in place of the detection', async () => {
    open();
    await pickFile(label('wall'));
    expect(screen.queryByTestId('note-box-0')).toBeNull();
    expect(screen.getAllByTestId(/^note-box-/)).toHaveLength(2);
    expect(screen.getByText('Place order')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Add 2 notes$/ })).toBeTruthy();
  });

  it('refuses a label for another photo, and says which', async () => {
    open();
    await pickFile(label('another-wall'));
    expect(screen.getByTestId('photo-label-error').textContent).toMatch(/another-wall.*wall/);
    // The detection is untouched.
    expect(screen.getByTestId('note-box-0')).toBeTruthy();
  });

  it('refuses a file that is not a label at all', async () => {
    open();
    await pickFile(new File(['not json'], 'wall.json', { type: 'application/json' }));
    expect(screen.getByTestId('photo-label-error').textContent).toMatch(/not a saved label/i);
  });
});

describe('the tick of a selected box', () => {
  it('moves into the toolbar, out from under the corner handle, and still works', () => {
    render(
      <PhotoReviewOverlay
        review={review({ detection: found([sticky(0)]) })}
        reading={false}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    fireEvent.pointerDown(screen.getByTestId('note-body-0'));
    // Still exactly one tick for the box — now in the toolbar.
    const ticks = screen.getAllByRole('checkbox');
    expect(ticks).toHaveLength(1);
    expect(screen.getByRole('toolbar', { name: /correct this box/i }).contains(ticks[0]!)).toBe(
      true,
    );
    fireEvent.click(ticks[0]!);
    expect(ticks[0]!.getAttribute('aria-checked')).toBe('false');
  });
});

// When too many notes could not be read (spec/139 Phase 9): the review says
// so, politely, and leaves the choice to the author.
describe('the unread tip', () => {
  const stickies = Array.from({ length: 10 }, (_, i) => ({ ...sticky(i), x: i * 9 }));
  const words = (unread: number) =>
    new Map(
      stickies.map((s) => [
        s.id,
        s.id < unread ? { text: '', legible: false } : { text: `note ${s.id}`, legible: true },
      ]),
    );
  const open = (
    over: Partial<PhotoReview> = {},
    extra: { reading?: boolean; onRetake?: () => void } = {},
  ) =>
    render(
      <PhotoReviewOverlay
        review={review({ detection: found(stickies), ...over })}
        reading={extra.reading ?? false}
        onConfirm={noop}
        onCancel={noop}
        onRetake={extra.onRetake ?? noop}
      />,
    );
  const tip = () => screen.queryByTestId('photo-unread-tip');

  it('offers a better photo or typing, when a tenth or more went unread', () => {
    open({ textById: words(1) });
    expect(tip()?.textContent).toMatch(/1 of 10 notes couldn.t be read/i);
    expect(screen.getByRole('button', { name: /try another photo/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /i.ll type them/i })).toBeTruthy();
  });

  it('stays quiet below a tenth', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ ...sticky(i), x: i * 4 }));
    render(
      <PhotoReviewOverlay
        review={review({
          detection: found(many),
          textById: new Map(
            many.map((s) => [
              s.id,
              s.id === 0 ? { text: '', legible: false } : { text: 'x', legible: true },
            ]),
          ),
        })}
        reading={false}
        onConfirm={noop}
        onCancel={noop}
        onRetake={noop}
      />,
    );
    expect(tip()).toBeNull();
  });

  it('waits until the reader has finished', () => {
    open({ textById: words(5) }, { reading: true });
    expect(tip()).toBeNull();
  });

  it('says nothing of its own when the reader failed outright', () => {
    open({ textById: new Map(), readError: 'ai_error' });
    expect(tip()).toBeNull();
  });

  it('counts a note the author typed the words into as read', () => {
    open({ textById: words(1) });
    fireEvent.click(screen.getByTestId('note-words-0'));
    const input = screen.getByRole('textbox', { name: /the words on this note/i });
    fireEvent.change(input, { target: { value: 'Order placed' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(tip()).toBeNull();
  });

  it('goes away when the author chooses to type them', () => {
    open({ textById: words(3) });
    fireEvent.click(screen.getByRole('button', { name: /i.ll type them/i }));
    expect(tip()).toBeNull();
  });

  it('hands the choice of a new photo back to the editor', () => {
    const onRetake = vi.fn();
    open({ textById: words(3) }, { onRetake });
    fireEvent.click(screen.getByRole('button', { name: /try another photo/i }));
    expect(onRetake).toHaveBeenCalled();
  });
});

// The in-browser reader's model is ~160 MB, fetched once per device. A
// download that size with nothing moving on screen reads as a hang.
describe('the reading model downloading', () => {
  const MB = 1024 * 1024;
  const open = (modelDownload?: { loaded: number; total: number; done: boolean }) =>
    render(
      <PhotoReviewOverlay
        review={review({ detection: found([sticky(0)]) })}
        reading
        modelDownload={modelDownload}
        onConfirm={noop}
        onCancel={noop}
      />,
    );

  it('shows how much of the model has arrived, as a progress bar', () => {
    open({ loaded: 45 * MB, total: 160 * MB, done: false });
    const bar = screen.getByRole('progressbar', { name: /reading model/i });
    expect(bar.getAttribute('aria-valuenow')).toBe('28');
    expect(screen.getByTestId('photo-model-download').textContent).toMatch(/45 of 160 MB/);
    // Said once: this is a one-time cost, not every import.
    expect(screen.getByTestId('photo-model-download').textContent).toMatch(/only the first time/i);
  });

  it('goes away when the model is ready', () => {
    open({ loaded: 160 * MB, total: 160 * MB, done: true });
    expect(screen.queryByTestId('photo-model-download')).toBeNull();
  });

  it('says nothing when there is no download (a server reader, or a cached model)', () => {
    open(undefined);
    expect(screen.queryByTestId('photo-model-download')).toBeNull();
  });
});

// Reading a big wall in the browser takes a while — one model generation per
// note. Without a count, slow looks exactly like stuck.
describe('reading progress', () => {
  const open = (extra: {
    readSoFar?: number;
    readTotal?: number;
    readerBackend?: 'webgpu' | 'wasm';
  }) =>
    render(
      <PhotoReviewOverlay
        review={review({ detection: found([sticky(0)]) })}
        reading
        {...extra}
        onConfirm={noop}
        onCancel={noop}
      />,
    );

  it('counts the notes read so far', () => {
    open({ readSoFar: 12, readTotal: 263 });
    expect(screen.getByTestId('photo-reading').textContent).toMatch(/12 of 263/);
  });

  it('says it is reading on the graphics card, when it is', () => {
    open({ readSoFar: 1, readTotal: 263, readerBackend: 'webgpu' });
    expect(screen.getByTestId('photo-reading').textContent).toMatch(/graphics card/i);
  });

  it('warns that the processor is slower, when that is where it runs', () => {
    open({ readSoFar: 1, readTotal: 263, readerBackend: 'wasm' });
    expect(screen.getByTestId('photo-reading').textContent).toMatch(/processor.*slower/i);
  });
});
