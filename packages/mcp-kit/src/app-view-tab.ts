// The canvas view's server side every product shares (each product's docs/specs/015-api/mcp-server.md "Interactive
// view (MCP Apps)"): what view_tab answers beside the SVG the product draws. The view box a click maps through, the
// boxes a click can open, a tab's pages for the pager, and the one-line result. Pure: each product's view-tab.ts reads
// the tab and draws it with its own renderer.
import type { ToolResult } from './tool-result';

export type ViewBox = { x: number; y: number; width: number; height: number };

/** A boxed element the view can open: its id (for the editor link), ref and label (for the hover title). */
export type ClickableElement = ViewBox & { id: string; ref: string; label: string | null };

/** A page as the pager names it. */
export type ViewPage = { id: string; name: string };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// The SVG's view box (`viewBox="x y w h"` on its root), as the view maps a click into the tab.
export function viewBoxOf(svg: string): ViewBox {
  const open = svg.indexOf('viewBox="');
  const close = open < 0 ? -1 : svg.indexOf('"', open + 9);
  const [x, y, width, height] = (close < 0 ? '' : svg.slice(open + 9, close))
    .split(' ')
    .map(Number);
  return [x, y, width, height].every(isNum)
    ? { x: x!, y: y!, width: width!, height: height! }
    : { x: 0, y: 0, width: 0, height: 0 };
}

const overlaps = (a: ViewBox, b: ViewBox) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

/**
 * Every boxed element drawn, bottom to top, with its ref and label: what a click in the view can open. Arrows are
 * left out (their box is not where they are drawn), and so is anything outside `within` (the shown page) when given.
 * `elements` are the ones the tab draws, its hidden layers already left out.
 */
export function clickableBoxes(
  elements: readonly { id: string; type: string }[],
  refOf: (id: string) => string,
  within?: ViewBox,
): ClickableElement[] {
  return elements.flatMap((el) => {
    const { x, y, width, height, label } = el as Partial<ViewBox> & { label?: unknown };
    if (el.type === 'arrow' || !isNum(x) || !isNum(y) || !isNum(width) || !isNum(height)) return [];
    const box = { x, y, width, height };
    if (within && !overlaps(box, within)) return [];
    const named = typeof label === 'string' && label.trim() ? label.trim() : null;
    return [{ id: el.id, ref: refOf(el.id), label: named, ...box }];
  });
}

/** The pages a tab lays out, as the pager names them: by name, or by place ("Page 2"). */
export function viewPagesOf(pages: readonly { id: string; name?: string }[]): ViewPage[] {
  return pages.map((p, i) => ({ id: p.id, name: p.name?.trim() || `Page ${i + 1}` }));
}

/** The page `pageId` names, or the first when it names none (a page since removed, or none asked for). */
export function pageOrFirst<P extends { id: string }>(
  pages: readonly P[],
  pageId?: string,
): P | undefined {
  return pages.find((p) => p.id === pageId) ?? pages[0];
}

/**
 * view_tab's answer: the structured value for the view, and a text block of one line, not the SVG, so a host without
 * MCP Apps that shows the tool to the model spends few tokens on it.
 */
export function canvasViewResult(
  value: {
    name: string;
    svg: string;
    elements: readonly unknown[];
    pages?: readonly unknown[];
  } & Record<string, unknown>,
): ToolResult {
  console.info('[mcp] view_tab', {
    bytes: value.svg.length,
    elements: value.elements.length,
    pages: value.pages?.length ?? 0,
  });
  return {
    content: [{ type: 'text', text: `Drew tab "${value.name}" for the interactive view.` }],
    structuredContent: value,
  };
}
