'use client';

// A tab window's drawing (docs/specs/009-elements/tab-window.md "The element"): the tab drawn as the editor shows it
// (useTabSvg: the export renderer, in this person's appearance, with its photos and the document's cards), zoomed to
// fit and centred on the tab's paper. Inline rather than an image so the page's typefaces apply, its ids prefixed so
// its gradients and markers never meet the canvas's. Loaded only once a window is on screen (the renderer is heavy).
import { useMemo } from 'react';
import { prefixSvgIds, type Tab } from '@livediagram/document';
import { useTabSvg } from '@/components/split/useTabSvg';

export function TabWindowDrawing({ tab, elementId }: { tab: Tab; elementId: string }) {
  const svg = useTabSvg(tab);
  const html = useMemo(() => {
    if (!svg) return null;
    const prefix = `tw-${elementId}-`.replace(/[^a-zA-Z0-9-]/g, '');
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${svg.width} ${svg.height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style="display:block">` +
      prefixSvgIds(svg.markup, prefix) +
      `</svg>`
    );
  }, [svg, elementId]);
  if (!html || !svg) return null;
  return (
    <div
      data-tab-window-drawing=""
      className="pointer-events-none absolute inset-0"
      style={{ background: svg.background }}
      // Our own renderer's output (every label is xmlEscaped inside it).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
