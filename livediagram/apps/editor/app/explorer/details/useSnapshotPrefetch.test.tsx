// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThumbnailRequest } from '@/lib/thumbnail-cache';
import { useSnapshotPrefetch } from './useSnapshotPrefetch';

const { loadThumbnail } = vi.hoisted(() => ({
  loadThumbnail: vi.fn(() => Promise.resolve({ status: 'broken' as const })),
}));
vi.mock('@/lib/thumbnail-cache', () => ({ loadThumbnail }));

let sightings: ((entries: { isIntersecting: boolean }[]) => void)[] = [];
const disconnect = vi.fn();

beforeEach(() => {
  sightings = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        sightings.push(cb);
      }
      observe() {}
      disconnect = disconnect;
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function Row({ request }: { request: ThumbnailRequest | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useSnapshotPrefetch(ref, request);
  return <div ref={ref} />;
}

const req: ThumbnailRequest = { ownerId: 'me', documentId: 'd1', version: 3, shareCode: null };

describe('useSnapshotPrefetch', () => {
  it('asks for the snapshot once the row nears the viewport, then stops watching', () => {
    render(<Row request={req} />);
    sightings[0]!([{ isIntersecting: false }]);
    expect(loadThumbnail).not.toHaveBeenCalled();
    sightings[0]!([{ isIntersecting: true }]);
    expect(loadThumbnail).toHaveBeenCalledWith(req);
    expect(disconnect).toHaveBeenCalled();
  });

  it('asks for nothing without a request', () => {
    render(<Row request={null} />);
    expect(sightings).toHaveLength(0);
  });
});
