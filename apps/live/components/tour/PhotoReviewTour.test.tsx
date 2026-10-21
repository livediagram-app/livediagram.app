// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DetectedSticky } from '@liveplanner/sticky-vision';
import type { PhotoReview } from '@/hooks/canvas/usePhotoDraft';
import { track } from '@/lib/telemetry';
import { PhotoReviewOverlay } from '@/components/chrome/PhotoReviewOverlay';
import { photoReviewTourSteps } from './photo-review-tour-steps';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
// jsdom lays nothing out, so "on screen" is just "in the document" here.
vi.mock('./tour-dom', async (actual) => ({
  ...(await actual<typeof import('./tour-dom')>()),
  waitForSelector: async (selector: string) => document.querySelector<HTMLElement>(selector),
}));
afterEach(() => {
  cleanup();
  vi.mocked(track).mockClear();
});

const sticky = (id: number): DetectedSticky => ({
  id,
  kind: 'domain-event',
  size: 'square',
  x: 10 + id * 20,
  y: 10,
  w: 15,
  h: 15,
  row: 0,
  order: id,
  confidence: 0.9,
});

function review(stickies: DetectedSticky[] | null): PhotoReview {
  return {
    photoUrl: 'blob:the-photo',
    photoName: 'wall.jpg',
    detection:
      stickies === null
        ? null
        : {
            stickies,
            crops: [],
            imageSize: { width: 100, height: 100 },
            photoUrl: 'data:image/jpeg;base64,xx',
            imageData: new Uint8ClampedArray(100 * 100 * 4),
            dropped: 0,
            detector: { path: 'classical', reason: 'no-worker' },
          },
    textById: new Map(),
    readError: null,
  };
}

function show(stickies: DetectedSticky[] | null) {
  const onCancel = vi.fn();
  render(
    <PhotoReviewOverlay
      review={review(stickies)}
      reading={false}
      onConfirm={() => {}}
      onCancel={onCancel}
    />,
  );
  return { onCancel };
}

const settle = () => act(async () => new Promise((r) => setTimeout(r, 30)));
const next = async () => {
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  await settle();
};

// docs/specs/021-event-storming/event-storming.md "Show Me".
describe('Photo review Show Me', () => {
  it('walks a box, its tick, its words and its toolbar, then drawing and adding', () => {
    expect(photoReviewTourSteps(true).map((s) => s.id)).toEqual([
      'box',
      'tick',
      'words',
      'correct',
      'draw',
      'add',
      'outro',
    ]);
    expect(photoReviewTourSteps(false).map((s) => s.id)).toEqual(['draw', 'add', 'outro']);
  });

  it('waits for the detector before it is offered, beside Help', () => {
    show(null);
    expect(screen.queryByRole('button', { name: 'Show Me' })).toBeNull();
    cleanup();
    show([sticky(0)]);
    expect(screen.getByRole('button', { name: 'Show Me' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /event-storming boards/i }).getAttribute('href')).toBe(
      '/help/canvas/event-storming-boards/',
    );
  });

  it('starts on the first box, and selects it for the correcting step only', async () => {
    show([sticky(0), sticky(1)]);
    fireEvent.click(screen.getByRole('button', { name: 'Show Me' }));
    await settle();
    expect(track).toHaveBeenCalledWith('UI', 'Started', 'PhotoReviewTour');
    expect(
      screen.getByRole('dialog', { name: /^Show Me step 1 of 6: Each Box Is a Note/ }),
    ).toBeTruthy();
    await next(); // Tick
    await next(); // Words
    await next(); // Correct
    expect(screen.getByRole('toolbar', { name: 'Correct this box' })).toBeTruthy();
    await next(); // Draw
    expect(screen.queryByRole('toolbar', { name: 'Correct this box' })).toBeNull();
  });

  it('lets go of a selected first box so the tick step finds its tick', async () => {
    show([sticky(0), sticky(1)]);
    fireEvent.pointerDown(screen.getByTestId('note-body-0'));
    expect(screen.getByRole('toolbar', { name: 'Correct this box' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show Me' }));
    await settle();
    await next(); // Tick
    expect(
      screen.getByRole('dialog', { name: /^Show Me step 2 of 6: Tick What to Keep/ }),
    ).toBeTruthy();
    expect(screen.queryByRole('toolbar', { name: 'Correct this box' })).toBeNull();
  });

  it('counts only drawing and adding when nothing was found', async () => {
    show([]);
    fireEvent.click(screen.getByRole('button', { name: 'Show Me' }));
    await settle();
    expect(
      screen.getByRole('dialog', { name: /^Show Me step 1 of 2: Draw One It Missed/ }),
    ).toBeTruthy();
  });

  it('keeps Escape from leaving the review while it runs: Escape ends the tour, not the review', async () => {
    const { onCancel } = show([sticky(0)]);
    fireEvent.click(screen.getByRole('button', { name: 'Show Me' }));
    await settle();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('UI', 'Ended', 'PhotoReviewTourSkipped');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });
});
