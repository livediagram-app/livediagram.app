// A request to open a page's panel on a tab, or to close it, from outside CanvasPages
// (docs/specs/007-editor/pages-tour.md "Code"), over this editor's panel tabs
// (@liveworkspace/workbench/lib/page-panel-request).
import { createPagePanelRequest } from '@liveworkspace/workbench/lib/page-panel-request';
import type { PagePanelTab } from '@/components/canvas/PagePanel';

export const { requestPagePanel, useFollowPagePanelRequests } =
  createPagePanelRequest<PagePanelTab>('page');
