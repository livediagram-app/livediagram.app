// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CollabApi } from './collab/CollabFaceRouter';
import { useStableCollab } from './element-layer-props';

// docs/specs/008-canvas/canvas-performance.md: the collab bag the editor mints per render keeps its
// identity while nothing a face shows changes, so every element view's memo holds.

function collab(over: Partial<CollabApi> = {}): CollabApi {
  return {
    selfKey: 'me',
    respond: vi.fn(),
    clearResponses: vi.fn(),
    ...over,
  };
}

function setup() {
  return renderHook(({ c }: { c: CollabApi }) => useStableCollab(c), {
    initialProps: { c: collab() },
  });
}

describe('useStableCollab', () => {
  it('keeps its identity across renders that mint an equal bag', () => {
    const { result, rerender } = setup();
    const first = result.current;
    rerender({ c: collab() });
    expect(result.current).toBe(first);
  });

  it('calls the newest handler through the stable one', () => {
    const { result, rerender } = setup();
    const respond = vi.fn();
    rerender({ c: collab({ respond }) });
    result.current.respond!({} as never, 'yes');
    expect(respond).toHaveBeenCalledWith({}, 'yes');
  });

  it('changes when a handler comes or goes', () => {
    const { result, rerender } = setup();
    const first = result.current;
    rerender({ c: collab({ respond: undefined }) });
    expect(result.current).not.toBe(first);
    expect(result.current.respond).toBeUndefined();
  });

  it('changes when its own data changes', () => {
    const { result, rerender } = setup();
    const first = result.current;
    rerender({ c: collab({ selfKey: 'someone' }) });
    expect(result.current).not.toBe(first);
  });
});
