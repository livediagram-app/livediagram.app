'use client';

// The fallback renderer and the registry lookup (docs/specs/013-workspace/timeline.md §7).
//
// The package ships a renderer that can draw ANY event from its
// title/description/source type alone. Consumers override per source
// type to add links and product-specific copy — but a source type a
// newer worker invented still renders correctly here rather than
// disappearing, which is the whole reason the fallback exists.

import { sourceTypeIconPath } from './sourceTypeMeta';
import type { TimelineEvent, TimelineRenderer, TimelineRendererRegistry } from './types';
import { Glyph } from '@livediagram/ui';

export function SourceTypeIcon({ sourceType }: { sourceType: string }) {
  return (
    <Glyph size={16} units={24} className="h-4 w-4" strokeLinecap="butt" strokeLinejoin="miter">
      <path strokeLinecap="round" strokeLinejoin="round" d={sourceTypeIconPath(sourceType)} />
    </Glyph>
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
