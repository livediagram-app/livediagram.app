'use client';

// A Diagram slot's drawing (DashboardDiagramView): the tab drawn as the editor shows it (useTabSvg: the export
// renderer, in this person's appearance, with its photos and the document's cards), handed to an image as SVG, so it
// scales to fit the slot, never runs anything, and costs the page one element however big the diagram. Re-encoded
// only when the drawing changes (useTabSvg defers a burst of edits).
import { useMemo } from 'react';
import type { Tab } from '@livediagram/document';
import { useTabSvg } from '@/components/split/useTabSvg';

export function DashboardDiagramImage({ tab }: { tab: Tab }) {
  const svg = useTabSvg(tab);
  const markup = svg?.markup;
  const url = useMemo(
    () => (markup ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}` : null),
    [markup],
  );
  if (!url) return null;
  return (
    <img
      src={url}
      alt={`${tab.name}, drawn`}
      draggable={false}
      className="h-full w-full object-contain"
    />
  );
}
