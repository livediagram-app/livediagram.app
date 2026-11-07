import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommunityBar } from './CommunityBar';

// The bar over an item opened from the Community (liveworkspace/docs/specs/007-community/community.md).

afterEach(cleanup);

const community = {
  postId: 'post1',
  author: { name: 'Anonymous', color: '#64748b', picture: null },
};

describe('CommunityBar', () => {
  it('names who shared it, leads back to the post, and offers a visitor Make a Copy', () => {
    const onMakeCopy = vi.fn();
    render(<CommunityBar community={community} own={null} onMakeCopy={onMakeCopy} copying={false} />);
    expect(screen.getByRole('region', { name: 'Community' }).textContent).toContain(
      'Shared to the Community by Anonymous',
    );
    expect(screen.getByRole('link', { name: /Back to Community/ }).getAttribute('href')).toBe(
      '/community/post?id=post1',
    );
    fireEvent.click(screen.getByRole('button', { name: /Make a Copy/ }));
    expect(onMakeCopy).toHaveBeenCalledTimes(1);
  });

  it('says Copying while it copies, and gives the author their own way back instead', () => {
    render(<CommunityBar community={community} own={null} onMakeCopy={vi.fn()} copying />);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /Copying/ }).disabled).toBe(true);
    cleanup();
    render(
      <CommunityBar
        community={community}
        own={{ href: '/project/p-9', label: 'Edit Your Plan' }}
        onMakeCopy={vi.fn()}
        copying={false}
      />,
    );
    expect(screen.queryByRole('button', { name: /Make a Copy/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Edit Your Plan/ }).getAttribute('href')).toBe(
      '/project/p-9',
    );
  });
});
