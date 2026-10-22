// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PhotoDraftState } from '@/hooks/canvas/usePhotoDraft';
import { PhotoImportProgress } from './PhotoImportProgress';

const idle: PhotoDraftState = { stage: 'idle', found: 0, readSoFar: 0, error: null };

describe('PhotoImportProgress', () => {
  it('shows nothing while idle', () => {
    const { container } = render(<PhotoImportProgress state={idle} onCancel={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('announces detection the moment it starts', () => {
    render(<PhotoImportProgress state={{ ...idle, stage: 'detecting' }} onCancel={vi.fn()} />);
    expect(screen.getByText('Finding the stickies…')).toBeTruthy();
  });

  it('hands off to the review the moment detection finishes', () => {
    // The words stream in inside the review overlay, not in this strip.
    const { container } = render(
      <PhotoImportProgress
        state={{ ...idle, stage: 'review', found: 34, readSoFar: 12 }}
        onCancel={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('cancels on demand', () => {
    const onCancel = vi.fn();
    render(<PhotoImportProgress state={{ ...idle, stage: 'detecting' }} onCancel={onCancel} />);
    screen.getByRole('button', { name: /^Cancel$/ }).click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
