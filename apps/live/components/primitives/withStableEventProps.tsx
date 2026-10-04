'use client';

// A render boundary (docs/specs/008-canvas/canvas-performance.md "The canvas re-renders only for what it
// shows"): the wrapped component is memoised and receives its `on…` props as stable forwarders, so a
// parent render that rebuilt the handlers but changed no data re-renders nothing below it.

import { memo, type ComponentType } from 'react';
import { useStableEventProps } from '@/hooks/ui/useStableEventProps';

export function withStableEventProps<P extends object>(Inner: ComponentType<P>): ComponentType<P> {
  const Memoised = memo(Inner) as unknown as ComponentType<P>;
  function StableEventBoundary(props: P) {
    return <Memoised {...useStableEventProps(props)} />;
  }
  StableEventBoundary.displayName = `withStableEventProps(${Inner.displayName ?? Inner.name})`;
  return StableEventBoundary;
}
