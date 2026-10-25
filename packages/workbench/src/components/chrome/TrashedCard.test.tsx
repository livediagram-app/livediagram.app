// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TRASH_RETENTION_MS } from '@liveworkspace/index-client';
import { TrashedCard, daysLeftLabel, trashedCardHeading, trashedCardLead } from './TrashedCard';

afterEach(() => cleanup());

const DAY = 24 * 60 * 60 * 1000;

// docs/specs/013-workspace/trash.md "While a file is in the Trash", in the product's word.
describe('TrashedCard', () => {
  it('heads the card in the noun it is given', () => {
    expect(trashedCardHeading({ reason: 'empty' }, 'plan')).toEqual({
      label: 'In the Trash',
      title: 'This plan is in the Trash',
    });
    expect(trashedCardHeading(null, 'design')).toEqual({
      label: 'Deleted',
      title: 'This design was deleted',
    });
  });

  it('counts the days left before the clean-up', () => {
    const now = 1_000 * DAY;
    expect(daysLeftLabel(now - TRASH_RETENTION_MS, now)).toBe('Removed at the next clean-up');
    expect(daysLeftLabel(now - TRASH_RETENTION_MS + DAY, now)).toBe('1 day left');
    expect(
      trashedCardLead({ trashedAt: now - TRASH_RETENTION_MS + 3 * DAY, reason: 'empty' }, now),
    ).toBe('It was empty, so it moved to the Trash (3 days left).');
  });

  it('offers Restore to someone who may, and says so when it fails', async () => {
    const onRestore = vi.fn(() => Promise.reject(new Error('no')));
    render(
      <TrashedCard
        noun="design"
        restorable={{ trashedAt: Date.now(), reason: null }}
        onRestore={onRestore}
      />,
    );
    expect(screen.getByRole('heading', { name: 'This design was deleted' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(onRestore).toHaveBeenCalledOnce();
    expect(await screen.findByText('Could not restore it. Please try again.')).toBeTruthy();
  });

  it('only tells a share-link visitor that it was deleted', () => {
    render(<TrashedCard noun="plan" restorable={null} onRestore={() => Promise.resolve()} />);
    expect(screen.getByRole('heading', { name: 'This plan was deleted' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Restore' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Go to Explorer' })).toBeTruthy();
  });
});
