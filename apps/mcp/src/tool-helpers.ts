// Shared plumbing for the MCP tools (spec/62), split out of tools.ts:
// the result / auth helpers every tool uses, and the layout + theme tab
// builders that turn validated elements (or a template) into a
// persistable Tab. tools.ts keeps the tool registrations themselves.

import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import {
  autoLayoutElements,
  coerceShapeKind,
  getBuiltInTheme,
  isLayoutCandidate,
  nodesLookUnplaced,
  recolourElementsForTheme,
  renderElementsToSvg,
  type Element,
  type Tab,
} from '@livediagram/diagram';
// Static-import icon resolver (Worker bundle, size not user-facing) so icon
// elements render their real glyph in the inline image.
import { resolveIconExportArt } from '@livediagram/icons/resolve';
import {
  TEMPLATES,
  buildTemplate,
  templateCanvasOverrides,
  type TemplateKind,
} from '@livediagram/templates';
import { svgToPngBase64 } from './render';

export type Extra = RequestHandlerExtra<never, never>;
export type ToolResult = {
  content: Array<
    { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }
  >;
  isError?: boolean;
};

export const deepLink = (id: string) => `https://livediagram.app/diagram/${id}`;

export function requireToken(extra: Extra): string {
  const token = extra.authInfo?.token;
  if (!token) throw new Error('unauthorized: no bearer token');
  return token;
}

export function textResult(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export async function imageResult(value: unknown, tab: Tab): Promise<ToolResult> {
  const png = await svgToPngBase64(
    renderElementsToSvg(tab, { resolveIconArt: resolveIconExportArt }),
  );
  return {
    content: [
      { type: 'text', text: JSON.stringify(value, null, 2) },
      { type: 'image', data: png, mimeType: 'image/png' },
    ],
  };
}

// Layout is the model's call (spec/62 §4.3). 'preserve' keeps the coordinates
// it gave (a ring for a cycle, a tree, a grid); 'auto' forces a clean server
// layout; omitted = preserve a real arrangement, but auto-lay-out when the
// model left everything piled at one spot. Either way the connected graph is
// the only thing arranged — edgeless content keeps its place.
export function applyLayout(
  layout: 'auto' | 'preserve' | undefined,
  elements: Element[],
): Element[] {
  const shouldLayout =
    layout === 'auto' ? true : layout === 'preserve' ? false : nodesLookUnplaced(elements);
  return shouldLayout && isLayoutCandidate(elements) ? autoLayoutElements(elements) : elements;
}

// Build a finished, persistable Tab from validated elements: apply the layout,
// then paint the chosen preset theme onto the elements + the canvas backdrop —
// the same engine the editor uses (spec/62). `themeId` defaults to brand;
// unknown ids fall back to it. `elements` must already be a valid Element[].
export function buildTab(
  tabId: string,
  name: string,
  elements: Element[],
  layout: 'auto' | 'preserve' | undefined,
  themeId: string | undefined,
): Tab {
  const theme = getBuiltInTheme(themeId);
  // Coerce off-vocabulary shape kinds (e.g. a model emitting "rectangle", which
  // isn't a kind — the box is "square") so every node actually renders a box.
  const coerced = elements.map((el) =>
    el.type === 'shape' ? { ...el, shape: coerceShapeKind(el.shape) } : el,
  );
  const laidOut = applyLayout(layout, coerced);
  return {
    id: tabId,
    name,
    elements: recolourElementsForTheme(laidOut, theme),
    theme: theme.id,
    backgroundColor: theme.backgroundColor,
    backgroundPattern: theme.backgroundPattern,
    patternColor: theme.patternColor,
    ...(theme.backgroundOpacity != null ? { backgroundOpacity: theme.backgroundOpacity } : {}),
  };
}

// Resolve a tool's `template` argument against the shared catalogue
// (spec/62 §4.5). Returns null for an unknown kind — the caller answers
// with the valid kinds so the model can self-correct without a round
// trip to list_templates.
export function resolveTemplate(kind: string): TemplateKind | null {
  return TEMPLATES.some((t) => t.kind === kind) ? (kind as TemplateKind) : null;
}

export const validTemplateKinds = () => TEMPLATES.map((t) => t.kind).join(', ');

// Materialise a template tab: the curated scaffold at its hand-tuned
// coordinates (layout deliberately NOT run — that's the point of a
// template), themed by buildTab like any other elements, plus the
// template's canvas overrides + the templateChosen flag the editor's
// Quick Start uses.
export function buildTemplateTab(
  tabId: string,
  name: string,
  kind: TemplateKind,
  themeId?: string,
): Tab {
  return {
    ...buildTab(tabId, name, buildTemplate(kind, 0, 0), 'preserve', themeId),
    templateChosen: true,
    ...templateCanvasOverrides(kind),
  };
}
