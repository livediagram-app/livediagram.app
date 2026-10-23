// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Element } from '@livedocuments/document';
import type { CollabDeepLink } from '@/lib/collab-deep-link';
import { useCollabDeepLink, useCollabDeepLinkCapture } from './useCollabDeepLink';
import type { TabLoadState } from './editor-page-helpers';

// Arriving from an Inbox row (docs/specs/013-workspace/inbox.md §1): an element and its popover. Consumed once, and
// only on the right tab.

const box = {
  id: 'b1',
  type: 'shape',
  shape: 'square',
  x: 10,
  y: 20,
  width: 300,
  height: 200,
} as unknown as Element;

function arrive(
  link: CollabDeepLink,
  over: { activeId?: string; state?: TabLoadState; elements?: Element[] } = {},
) {
  const calls = {
    select: vi.fn(),
    scrollIntoView: vi.fn(),
    openActionPopover: vi.fn(),
    openComments: vi.fn(),
  };
  const props = {
    link: { current: link },
    hydrated: true,
    activeId: over.activeId ?? 't1',
    activeTabLoadState: over.state ?? 'ready',
    elements: over.elements ?? [box],
    ...calls,
  };
  const hook = renderHook((p: typeof props) => useCollabDeepLink(p), { initialProps: props });
  return { calls, hook, props };
}

describe('useCollabDeepLink', () => {
  it('selects the element and opens its popover', () => {
    const { calls } = arrive({ at: { tabId: 't1', elementId: 'b1' }, open: 'action' });
    expect(calls.select).toHaveBeenCalledWith('b1');
    expect(calls.scrollIntoView).toHaveBeenCalledWith(10, 20, 300, 200, { center: true });
    expect(calls.openActionPopover).toHaveBeenCalledWith('b1');
    expect(calls.openComments).not.toHaveBeenCalled();
  });

  it('waits for the named tab and its load, then fires once', () => {
    const { calls, hook, props } = arrive(
      { at: { tabId: 't2', elementId: 'b1' }, open: 'action' },
      { activeId: 't1' },
    );
    expect(calls.openActionPopover).not.toHaveBeenCalled();
    hook.rerender({ ...props, activeId: 't2', activeTabLoadState: 'loading' });
    expect(calls.openActionPopover).not.toHaveBeenCalled();
    hook.rerender({ ...props, activeId: 't2', activeTabLoadState: 'ready' });
    hook.rerender({ ...props, activeId: 't2', activeTabLoadState: 'ready', elements: [box] });
    expect(calls.openActionPopover).toHaveBeenCalledTimes(1);
  });

  it('opens nothing when the tab failed to load', () => {
    const { calls } = arrive(
      { at: { tabId: 't1', elementId: 'b1' }, open: 'action' },
      { state: 'error' as TabLoadState },
    );
    expect(calls.openActionPopover).not.toHaveBeenCalled();
    expect(calls.select).not.toHaveBeenCalled();
  });

  it('opens a thread’s comments', () => {
    const { calls } = arrive({ at: { tabId: 't1', elementId: 'b1' }, open: 'comments' });
    expect(calls.openComments).toHaveBeenCalledWith('b1');
  });
});

describe('useCollabDeepLinkCapture', () => {
  it('captures the link from the fragment and keeps it when the hash is rewritten to a plain pin', () => {
    window.location.hash = '#t=t1&el=b1&open=comments';
    const { result, rerender } = renderHook(() => useCollabDeepLinkCapture());
    expect(result.current.current).toEqual({
      at: { tabId: 't1', elementId: 'b1' },
      open: 'comments',
    });
    window.location.hash = '#t=t1';
    rerender();
    expect(result.current.current?.open).toBe('comments');
  });

  it('holds nothing for a plain tab pin', () => {
    window.location.hash = '#t=t1';
    const { result } = renderHook(() => useCollabDeepLinkCapture());
    expect(result.current.current).toBeNull();
  });
});
