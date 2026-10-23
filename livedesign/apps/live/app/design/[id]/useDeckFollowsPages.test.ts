// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedesign/design';
import { useDeckFollowsPages } from './useDeckFollowsPages';

// docs/specs/007-editor/pages-mode.md "Slides": one follow pass when the pages change, none on an element edit
// and none before the design has loaded.
const tab = (pageIds: string[], elements: unknown[] = []) =>
  ({
    id: 't',
    name: 'Deck',
    elements,
    opensIn: 'pages',
    pages: pageIds.map((id) => ({ id, orientation: 'landscape', kind: 'slide' })),
  }) as unknown as Tab;

describe('useDeckFollowsPages', () => {
  it('follows once loaded, then on a page change, never on an element edit', () => {
    const followPages = vi.fn();
    const { rerender } = renderHook(
      ({ tabs, ready }) =>
        useDeckFollowsPages({ tabs, ready, hasStoredDeck: false, designId: 'd', followPages }),
      { initialProps: { tabs: [tab(['a'])], ready: false } },
    );
    expect(followPages).not.toHaveBeenCalled();
    rerender({ tabs: [tab(['a'])], ready: true });
    expect(followPages).toHaveBeenCalledTimes(1);
    rerender({ tabs: [tab(['a'], [{ id: 'e' }])], ready: true });
    expect(followPages).toHaveBeenCalledTimes(1);
    rerender({ tabs: [tab(['a', 'b'])], ready: true });
    expect(followPages).toHaveBeenCalledTimes(2);
  });
});
