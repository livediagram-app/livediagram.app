// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMMUNITY_CATEGORIES, type CommunityCategory } from '@livediagram/api-schema';

// The publish dialog's pieces (docs/specs/025-community/community.md "Publishing"): the category radio group, the
// card preview, and the confirmation once a post is live.

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('@/components/panels/DocumentThumbnail', () => ({
  DocumentThumbnail: () => <span>Snapshot</span>,
}));

import { CategoryPicker } from './CategoryPicker';
import { CommunityCardPreview } from './CommunityCardPreview';
import { CommunityPublishedConfirmation } from './CommunityPublishedConfirmation';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Picker({ start = null }: { start?: CommunityCategory | null }) {
  const [value, setValue] = useState<CommunityCategory | null>(start);
  return (
    <>
      <span id="cat-label">Category</span>
      <CategoryPicker value={value} onChange={setValue} labelledBy="cat-label" />
    </>
  );
}

describe('CategoryPicker', () => {
  it('is one radio group: a click picks, arrow keys move and wrap, one stop in the tab order', () => {
    render(<Picker />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(COMMUNITY_CATEGORIES.length);
    expect(radios.filter((r) => r.tabIndex === 0)).toHaveLength(1);

    fireEvent.click(radios[1]!);
    expect(radios[1]!.getAttribute('aria-checked')).toBe('true');

    fireEvent.keyDown(radios[1]!, { key: 'ArrowRight' });
    expect(screen.getAllByRole('radio')[2]!.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(screen.getAllByRole('radio')[2]);

    fireEvent.keyDown(screen.getAllByRole('radio')[2]!, { key: 'ArrowUp' });
    fireEvent.keyDown(screen.getAllByRole('radio')[1]!, { key: 'ArrowLeft' });
    fireEvent.keyDown(screen.getAllByRole('radio')[0]!, { key: 'ArrowLeft' });
    const last = screen.getAllByRole('radio').at(-1)!;
    expect(last.getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(last.getAttribute('aria-checked')).toBe('true');
  });

  it('describes the chosen category beneath', () => {
    const first = COMMUNITY_CATEGORIES[0]!;
    render(<Picker start={first.id} />);
    expect(screen.getByText(first.blurb)).toBeTruthy();
  });
});

describe('CommunityCardPreview', () => {
  it('is the real card, with the snapshot, a title fallback and a category prompt', () => {
    render(
      <CommunityCardPreview
        ownerId="user_a"
        documentId="d1"
        title="  "
        category={null}
        tags={['aws']}
        author={{ name: 'Anonymous', color: '#64748b', picture: null }}
        likeCount={2}
      />,
    );
    expect(screen.getByRole('group', { name: 'Card preview' })).toBeTruthy();
    expect(screen.getByText('Snapshot')).toBeTruthy();
    expect(screen.getByText('Your title')).toBeTruthy();
    expect(screen.getByText('Choose a Category')).toBeTruthy();
    expect(screen.getByText('2 likes')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('CommunityPublishedConfirmation', () => {
  it('celebrates, links to the post, copies its address, and closes on Done', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const onDone = vi.fn();
    render(<CommunityPublishedConfirmation postId="post1" title="Payments" onDone={onDone} />);
    expect(screen.getByRole('heading', { name: 'Shared to the Community' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('is live');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('link', { name: /View Post/ }).getAttribute('href')).toBe(
      '/community/post/?id=post1',
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy Link/ }));
    });
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/community/post/?id=post1`);
    await waitFor(() => expect(screen.getByRole('button', { name: /Copied/ })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('says so when the link cannot be copied', async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) },
    });
    render(<CommunityPublishedConfirmation postId="post1" title="Payments" onDone={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy Link/ }));
    });
    expect(toast.error).toHaveBeenCalledWith(
      'Could not copy the link. Open the post to copy it from there.',
    );
  });
});
