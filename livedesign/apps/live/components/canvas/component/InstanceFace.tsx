'use client';

// An instance on the canvas (docs/specs/009-elements/components.md "How an instance draws"): its main's elements,
// overrides applied, drawn inside its box by the export's own element drawers; or, while the library loads, a quiet
// Loading frame; or, with no main, the dashed Missing Component frame the exports draw too. The box is the element:
// it selects, drags, turns and resizes like any shape, and nothing inside it is picked on its own.
import { memo, useMemo } from 'react';
import { prefixSvgIds, type CanvasSurface, type ShapeElement } from '@livedesign/design';
import { trustedHtml } from '@livedesign/ui';
import { instanceMarkup } from '@/lib/instance-svg';
import { useComponentFaces } from './component-face-context';

export const InstanceFace = memo(function InstanceFace({
  element,
  surface,
}: {
  element: ShapeElement;
  surface: CanvasSurface;
}) {
  const ctx = useComponentFaces();
  const main = element.componentId ? ctx?.lookup(element.componentId) : undefined;
  const tab = ctx?.tab;
  const paper = ctx?.paper ?? '#ffffff';
  // Redrawn when the box's size, its overrides, its main or the tab's look change; a move redraws nothing.
  const { width, height, componentOverrides, id } = element;
  const markup = useMemo(() => {
    if (!main || !tab) return null;
    const box: ShapeElement = {
      id,
      type: 'shape',
      shape: 'instance',
      x: 0,
      y: 0,
      width,
      height,
      ...(componentOverrides ? { componentOverrides } : {}),
    };
    const inner = instanceMarkup(box, main, tab, surface, paper);
    return prefixSvgIds(inner, `ci-${id}-`.replace(/[^a-zA-Z0-9-]/g, ''));
  }, [main, tab, surface, paper, width, height, componentOverrides, id]);

  if (!markup) {
    const loading = !ctx || !ctx.loaded;
    return (
      <div
        data-instance-face={loading ? 'loading' : 'missing'}
        className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-sm border border-dashed border-slate-400 text-center text-xs text-slate-500"
      >
        {loading ? 'Loading component' : 'Missing component'}
      </div>
    );
  }
  return (
    <svg
      data-instance-face="drawn"
      xmlns="http://www.w3.org/2000/svg"
      className="pointer-events-none absolute inset-0"
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      aria-hidden="true"
      style={{ display: 'block' }}
      // Our own renderer's output (every label is xmlEscaped inside it).
      dangerouslySetInnerHTML={{ __html: trustedHtml(markup) }}
    />
  );
});
