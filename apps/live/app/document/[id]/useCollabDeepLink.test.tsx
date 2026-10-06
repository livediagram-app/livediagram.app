// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Element } from '@livediagram/document';
import type { CollabDeepLink } from '@/lib/collab-deep-link';
import { useCollabDeepLink } from './useCollabDeepLink';
import type { TabLoadState } from './editor-page-helpers';

// Arriving from an Activity row (docs/specs/013-workspace/activity-page.md §1): an element and its popover,
// or a Plan card on its board (§2.4), or a card no board shows. Consumed once, and only on the right tab.

const board = {
  id: 'b1',
  type: 'shape',
  shape: 'plan-board',
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
    openItem: vi.fn(),
  };
  const props = {
    link: { current: link },
    hydrated: true,
    activeId: over.activeId ?? 't1',
    activeTabLoadState: over.state ?? ('ready' as TabLoadState),
    elements: over.elements ?? [board],
    ...calls,
  };
  const hook = renderHook((p: typeof props) => useCollabDeepLink(p), { initialProps: props });
  return { calls, hook, props };
}

describe('useCollabDeepLink', () => {
  it('selects the element and opens its popover', () => {
    const { calls } = arrive({
      at: { tabId: 't1', elementId: 'b1' },
      open: 'action',
      itemId: null,
    });
    expect(calls.select).toHaveBeenCalledWith('b1');
    expect(calls.scrollIntoView).toHaveBeenCalledWith(10, 20, 300, 200, { center: true });
    expect(calls.openActionPopover).toHaveBeenCalledWith('b1');
    expect(calls.openItem).not.toHaveBeenCalled();
  });

  it('lands on a card’s board and opens the card', () => {
    const { calls } = arrive({ at: { tabId: 't1', elementId: 'b1' }, open: null, itemId: 'it1' });
    expect(calls.select).toHaveBeenCalledWith('b1');
    expect(calls.openItem).toHaveBeenCalledWith('it1');
    expect(calls.openActionPopover).not.toHaveBeenCalled();
    expect(calls.openComments).not.toHaveBeenCalled();
  });

  it('opens a card with no board on whichever tab the document opens on', () => {
    const { calls } = arrive({ at: null, open: null, itemId: 'it1' }, { activeId: 'other' });
    expect(calls.openItem).toHaveBeenCalledWith('it1');
    expect(calls.select).not.toHaveBeenCalled();
  });

  it('waits for the named tab and its load, then fires once', () => {
    const { calls, hook, props } = arrive(
      { at: { tabId: 't2', elementId: 'b1' }, open: null, itemId: 'it1' },
      { activeId: 't1' },
    );
    expect(calls.openItem).not.toHaveBeenCalled();
    hook.rerender({ ...props, activeId: 't2', activeTabLoadState: 'loading' });
    expect(calls.openItem).not.toHaveBeenCalled();
    hook.rerender({ ...props, activeId: 't2', activeTabLoadState: 'ready' });
    hook.rerender({ ...props, activeId: 't2', activeTabLoadState: 'ready', elements: [board] });
    expect(calls.openItem).toHaveBeenCalledTimes(1);
  });

  it('opens nothing when the tab failed to load', () => {
    const { calls } = arrive(
      { at: { tabId: 't1', elementId: 'b1' }, open: null, itemId: 'it1' },
      { state: 'error' as TabLoadState },
    );
    expect(calls.openItem).not.toHaveBeenCalled();
    expect(calls.select).not.toHaveBeenCalled();
  });
});
