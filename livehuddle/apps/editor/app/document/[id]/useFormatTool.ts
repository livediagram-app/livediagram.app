import { useEffect, useRef } from 'react';
import type { CanvasTool } from '@/components/palette/palette.types';

// The persistent Format painter tool's mode boundary (docs/specs/008-canvas/canvas-and-palette.md), lifted
// out of useEditorState as one cohesive slice. Active while the painter is on,
// started from the selection toolbar's Format Painter button with the selected
// element loaded (startFormatFrom): each click then paints its style (see useEditorDrag).
// Leaving the tool disarms the source and entering it starts clean. A
// ref tracks the previous tool so the reset fires only on the
// format-tool boundary.
export function useFormatTool({
  canvasTool,
  setCanvasTool,
  setFormatSourceId,
}: {
  canvasTool: CanvasTool;
  setCanvasTool: (tool: CanvasTool) => void;
  setFormatSourceId: (id: string | null) => void;
}) {
  const formatToolActive = canvasTool === 'format';
  const prevCanvasToolRef = useRef(canvasTool);
  // The tool that was active when Format was entered, so wrapping up the
  // Format tool returns the user to what they were doing (docs/specs/008-canvas/canvas-and-palette.md) rather
  // than always dropping to Select.
  const preFormatToolRef = useRef<CanvasTool>('select');
  // The element the painter starts loaded with, handed to the boundary below as it enters.
  const startSourceRef = useRef<string | null>(null);
  useEffect(() => {
    const wasFormat = prevCanvasToolRef.current === 'format';
    if (wasFormat !== formatToolActive) {
      setFormatSourceId(formatToolActive ? startSourceRef.current : null);
      startSourceRef.current = null;
    }
    if (!wasFormat && formatToolActive) preFormatToolRef.current = prevCanvasToolRef.current;
    prevCanvasToolRef.current = canvasTool;
  }, [canvasTool, formatToolActive, setFormatSourceId]);
  // Wrap up the Format tool (the mode banner's "Done", or a click on the
  // empty canvas): restore the tool that was active before Format, falling
  // back to Select (the boundary effect above clears the armed source).
  const exitFormatTool = () => {
    const prev = preFormatToolRef.current;
    setCanvasTool(prev === 'format' ? 'select' : prev);
  };
  // The selection toolbar's Format Painter (docs/specs/008-canvas/canvas-and-palette.md "Format painter"): the
  // painter on, `id` its source. `pick` is the tracked tool picker, so the use is counted (Canvas·Used·FormatPainter).
  const startFormatFrom = (id: string, pick: (tool: CanvasTool) => void) => {
    if (formatToolActive) {
      setFormatSourceId(id);
      return;
    }
    startSourceRef.current = id;
    pick('format');
  };
  return { formatToolActive, exitFormatTool, startFormatFrom };
}
