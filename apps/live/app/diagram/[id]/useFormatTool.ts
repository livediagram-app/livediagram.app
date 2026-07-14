import { useEffect, useRef } from 'react';
import type { CanvasTool } from '@/components/palette/CommandPalette';

// The persistent Format painter tool's mode boundary (spec/09), lifted
// out of useEditorState as one cohesive slice. Active while the
// palette's Format tool is picked: clicking elements arms a source then
// paints its style onto each subsequent click (see useEditorDrag).
// Leaving the tool disarms the source so a stale source never drives
// the single-shot toolbar banner; entering it starts clean. A ref
// tracks the previous tool so the reset fires only on the format-tool
// boundary (a blanket `canvasTool !== 'format'` clear would wipe the
// single-shot painter the instant it armed, since that path runs with
// the Select tool active).
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
  // Format tool returns the user to what they were doing (spec/09) rather
  // than always dropping to Select.
  const preFormatToolRef = useRef<CanvasTool>('select');
  useEffect(() => {
    const wasFormat = prevCanvasToolRef.current === 'format';
    if (wasFormat !== formatToolActive) setFormatSourceId(null);
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
  return { formatToolActive, exitFormatTool };
}
