// Pure tab builders (docs/specs/015-api/mcp-server.md, docs/specs/024-agents/edit-operations.md): one copy for
// every product, @liveworkspace/element-model/tab-builders, bound to this model's shape kinds and its diagram keys, settled as the editor settles them on commit (diagram-key.md).
import { buildTabWith } from '@liveworkspace/element-model/tab-builders';
import { settleDiagramKeys } from './diagram-key';
import { coerceShapeKind } from './validate';
import type { Element, Tab } from './index';

export { applyLayout } from '@liveworkspace/element-model/tab-builders';

// Build a finished, persistable Tab from validated elements.
export function buildTab(
  tabId: string,
  name: string,
  elements: Element[],
  layout: 'auto' | 'preserve' | undefined,
  themeId: string | undefined,
): Tab {
  return buildTabWith({ coerceShapeKind, settle: settleDiagramKeys }, tabId, name, elements, layout, themeId);
}
