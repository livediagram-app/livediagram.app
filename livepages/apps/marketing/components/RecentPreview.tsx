'use client';

import type { RecentDiagram } from '@livepages/api-schema';
import { EDITOR_MODE_ICONS } from '@livepages/ui';
import { useRecentThumb } from './useRecentDiagrams';

// A recent document's preview (docs/specs/019-marketing/returning-visitor.md): its snapshot from this
// browser's cache (the editor leaves one on each save) on the document's own background colour, as the
// Explorer's cards draw it; with none, the Pages glyph on a quiet tint. The caller sizes it. Shared by
// the hero's recent row and its fan.
export function RecentPreview({
  diagram,
  className = '',
}: {
  diagram: RecentDiagram;
  className?: string;
}) {
  const thumb = useRecentThumb(diagram.id, diagram.savedAt);
  const Icon = EDITOR_MODE_ICONS.pages;
  return (
    <span
      className={`relative block overflow-hidden bg-(--hero-thumb) ${className}`}
      style={
        thumb.status === 'ready' && thumb.backgroundColor
          ? { backgroundColor: thumb.backgroundColor }
          : undefined
      }
    >
      {thumb.status === 'ready' ? (
        // A blob URL from the browser's own cache (static export: no image optimiser).
        <img
          src={thumb.url}
          alt=""
          className="hero-recent-thumb absolute inset-0 h-full w-full object-contain p-1.5"
        />
      ) : thumb.status === 'none' ? (
        <span className="absolute inset-0 flex items-center justify-center text-(--hero-icon)">
          <Icon size={28} />
        </span>
      ) : null}
    </span>
  );
}
