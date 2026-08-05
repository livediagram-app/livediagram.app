'use client';

// The fallback renderer and the registry lookup (spec/138 §7).
//
// The package ships a renderer that can draw ANY event from its
// title/description/source type alone. Consumers override per source
// type to add links and product-specific copy — but a source type a
// newer worker invented still renders correctly here rather than
// disappearing, which is the whole reason the fallback exists.

import { sourceTypeIconPath } from './sourceTypeMeta';
import type { TimelineEvent, TimelineRenderer, TimelineRendererRegistry } from './types';

export function SourceTypeIcon({ sourceType }: { sourceType: string }) {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={sourceTypeIconPath(sourceType)} />
    </svg>
  );
}

export const fallbackRenderer: TimelineRenderer = (event) => ({
  icon: <SourceTypeIcon sourceType={event.sourceType} />,
});

export function pickRenderer(
  event: TimelineEvent,
  registry: TimelineRendererRegistry,
): TimelineRenderer {
  return registry[event.sourceType] ?? fallbackRenderer;
}
