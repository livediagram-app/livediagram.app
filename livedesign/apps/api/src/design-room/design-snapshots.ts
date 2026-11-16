// A design's snapshots (docs/specs/013-workspace/snapshots.md; liveworkspace/docs/specs/013-snapshots/snapshots.md):
// the thin door onto @liveworkspace/snapshots. A snapshot is the design's own file (design-file.ts), components
// included, and a revert reads it back keeping every tab's id, puts the component library back as it was, writes its
// tabs in place, then tells the room, which forgets its ledger and closes every socket so each open editor reloads.

import type { Tab } from '@livedesign/design';
import {
  serveSnapshots,
  type SnapshotCaller,
  type SnapshotDoor,
} from '@liveworkspace/snapshots/server';
import { componentInsertStatements } from '../db/components';
import { replaceTabs } from '../db/tabs';
import { authorOf } from '../routes/changesets';
import { gateEdit, type DesignRouteContext } from '../routes/context';
import type { DesignEnv } from '../types';
import { exportDesignFile, readDesignFile } from './design-file';

export function designSnapshotDoor(env: DesignEnv, designId: string): SnapshotDoor {
  return {
    exportFile: async () => {
      const file = await exportDesignFile(env, designId, null);
      if (file.status !== 'ok') return null;
      return typeof file.body === 'string' ? file.body : new TextDecoder().decode(file.body);
    },
    replaceContent: async (text) => {
      const read = readDesignFile(text, { keepIds: true });
      if (!read.ok) return read.failure === 'too_large' ? 'too_large' : 'invalid';
      const { tabs, components = [] } = read.content.copy;
      // The library first: a main made since goes, the snapshot's come back as they were. Each tab write after
      // replaces that tab's component references.
      await env.DESIGN_DB.batch([
        env.DESIGN_DB.prepare(
          `DELETE FROM components WHERE id NOT IN (SELECT value ->> '$.id' FROM json_each(?1))`,
        ).bind(JSON.stringify(components)),
        ...componentInsertStatements(env, components),
      ]);
      await replaceTabs(
        env,
        designId,
        tabs.map((t) => ({
          tab: {
            ...(JSON.parse(t.data) as Omit<Tab, 'id' | 'name'>),
            id: t.id,
            name: t.name,
          },
          folder: t.folder,
        })),
      );
      return 'ok';
    },
    afterRevert: (generation) => env.SNAPSHOT_REVERTED?.(generation),
  };
}

// Editors of the whole design: a tab-scoped link, a workbench embed and a Participant or Viewer see nothing, and an
// API token is refused before anything is read.
async function snapshotCaller(ctx: DesignRouteContext, designId: string): Promise<SnapshotCaller> {
  const owner = ctx.resolveOwner();
  const mayUse = owner !== null && !ctx.workbench && (await gateEdit(ctx, designId));
  return {
    token: ctx.token !== null,
    mayUse,
    person: mayUse && owner !== null ? await authorOf(ctx, owner) : null,
  };
}

// Every request the room answers passes here: `/api/designs/<id>/snapshots...` is answered, a write on the design
// from before a revert is fenced, and the rest go on to `handle`.
export function serveDesignSnapshots(
  ctx: DesignRouteContext,
  handle: () => Promise<Response>,
): Promise<Response> {
  const [api, collection, designId, ...rest] = ctx.segments;
  if (api !== 'api' || collection !== 'designs' || !designId) return handle();
  return serveSnapshots({
    db: ctx.env.DESIGN_DB,
    itemId: designId,
    request: ctx.request,
    rest,
    caller: () => snapshotCaller(ctx, designId),
    door: () => designSnapshotDoor(ctx.env, designId),
    handle,
  });
}
