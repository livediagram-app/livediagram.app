// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook, screen, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CommunitySession } from '@/app/document/[id]/editor-realtime';
import { setCommunityState, useCommunityState } from '@/lib/community-state-store';
import { CommunityBar } from './CommunityBar';

// The bar over a document opened from the Community, and the store behind the header's Public badge
// (docs/specs/025-community/community.md "Viewing a post's document").

afterEach(cleanup);

const session = (ownDocumentId: string | null): CommunitySession =>
  ({
    postId: 'post1',
    author: { name: 'Anonymous', color: '#64748b', picture: null },
    ownDocumentId,
  }) as CommunitySession;

describe('CommunityBar', () => {
  it('names who shared it, leads back to the post, and offers a visitor Make a Copy', () => {
    const onMakeCopy = vi.fn();
    render(<CommunityBar community={session(null)} onMakeCopy={onMakeCopy} copying={false} />);
    expect(screen.getByRole('region', { name: 'Community' }).textContent).toContain(
      'Shared to the Community by Anonymous',
    );
    expect(screen.getByRole('link', { name: /Back to Community/ }).getAttribute('href')).toBe(
      '/community/post/?id=post1',
    );
    fireEvent.click(screen.getByRole('button', { name: /Make a Copy/ }));
    expect(onMakeCopy).toHaveBeenCalledTimes(1);
  });

  it('says Copying while it copies, and gives the author Edit Your Document instead', () => {
    render(<CommunityBar community={session(null)} onMakeCopy={vi.fn()} copying />);
    expect((screen.getByRole('button', { name: /Copying/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    cleanup();
    render(<CommunityBar community={session('doc-9')} onMakeCopy={vi.fn()} copying={false} />);
    expect(screen.queryByRole('button', { name: /Make a Copy/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Edit Your Document/ }).getAttribute('href')).toBe(
      '/document/doc-9',
    );
  });
});

describe('the Community state store', () => {
  it('tells each document its post state, and its readers when it changes', () => {
    const { result } = renderHook(() => useCommunityState('d1'));
    expect(result.current).toBeNull();
    act(() => setCommunityState('d1', 'listed'));
    expect(result.current).toBe('listed');
    act(() => setCommunityState('d2', 'hidden'));
    expect(result.current).toBe('listed');
    act(() => setCommunityState('d1', null));
    expect(result.current).toBeNull();
    expect(renderHook(() => useCommunityState(null)).result.current).toBeNull();
  });
});
