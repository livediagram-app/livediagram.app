// A connected tab the index adds to this design (liveworkspace/docs/specs/004-index/connected-tabs.md "Both ways"):
// the reverse of a connection made both ways, written through the internal door (routes/internal-items.ts) with the
// app's INDEX_KEY. The kit appends it (@liveworkspace/index-app connected-tabs.ts): an empty tab, loose, at the end of
// the tab bar, holding the connection in its column; this is how livedesign stores the tab, and the design-meta op
// that shows it to everyone with the design open.

import { appendConnectedTab, type ConnectedTabOutcome } from '@liveworkspace/index-app';
import type { ConnectedTabWrite } from '@liveworkspace/index-client';
import type { RoomOp } from '@livedesign/api-schema';
import { tabWriteStatements } from '../db/tabs';
import type { DesignEnv } from '../types';
import { readDesignMeta, readDesignOutline } from './design-content';

// The reverse write, or `not_found` for a design not started.
export async function addConnectedDesignTab(
  env: DesignEnv,
  designId: string,
  write: ConnectedTabWrite,
): Promise<ConnectedTabOutcome> {
  if (!(await readDesignMeta(env, designId))) return 'not_found';
  return appendConnectedTab(env.DESIGN_DB, designId, write, {
    linkTable: 'design_tabs',
    itemColumn: 'design_id',
    // Stored as any new tab is: an empty body (one page, read via `pagesOf`), its place, its stats and the
    // design's save time.
    insertTab: (tabId, name, orderIndex) =>
      tabWriteStatements(env, designId, { id: tabId, name, elements: [] }, orderIndex, {
        advance: true,
      }),
  });
}

// The design's tabs as an editor's own tab add sends them, so open editors place the new tab where it is.
export async function connectedTabArrival(
  env: DesignEnv,
  designId: string,
): Promise<RoomOp | null> {
  const outline = await readDesignOutline(env, designId);
  if (!outline.meta) return null;
  return {
    kind: 'design-meta',
    name: outline.meta.name,
    tabs: outline.tabs.map((t) => ({
      id: t.id,
      name: t.name,
      orderIndex: t.orderIndex,
      ...(t.folder ? { folder: t.folder } : {}),
      ...(t.connection ? { connection: t.connection } : {}),
    })),
  };
}
