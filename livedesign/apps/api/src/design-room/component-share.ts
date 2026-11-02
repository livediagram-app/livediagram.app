// The mains a shared tab carries (docs/specs/009-elements/components.md "Sharing, collaboration and storage"; the
// mechanism is tab-shares.ts): every body sent to another design holding the tab brings the mains its instances use,
// and the design taking it in keeps each as its own main under the same id, the later `updatedAt` winning. After
// that each design's library is its own.

import {
  componentRefIdsFromData,
  componentWithinBytes,
  isValidDesignComponent,
  type DesignComponent,
} from '@livedesign/design';
import { componentUpsertLaterStatements, readComponentsById } from '../db/components';
import type { DesignEnv } from '../types';

// What one shared body carries of mains, at most: a share message is one RPC (32 MiB at most) beside a body of up to
// MAX_TAB_BYTES. Mains past it stay behind; their instances draw as missing there until a later body carries them.
export const SHARED_COMPONENTS_MAX_BYTES = 8 * 1024 * 1024;

/** The mains a stored body's instances use, as this design holds them, within SHARED_COMPONENTS_MAX_BYTES. */
export async function sharedTabComponents(
  env: DesignEnv,
  data: string,
  budget = SHARED_COMPONENTS_MAX_BYTES,
): Promise<DesignComponent[]> {
  const out: DesignComponent[] = [];
  let left = budget;
  for (const main of await readComponentsById(env, componentRefIdsFromData(data))) {
    const bytes = JSON.stringify(main).length;
    if (bytes > left) continue;
    left -= bytes;
    out.push(main);
  }
  return out;
}

/** The upserts for the mains a body brought: only well-formed mains, within the byte cap, that the body's own
 *  instances use (a sender cannot fill another design's library with anything else). */
export function takeSharedTabComponents(
  env: DesignEnv,
  data: string,
  carried: unknown,
): D1PreparedStatement[] {
  if (!Array.isArray(carried) || carried.length === 0) return [];
  const used = new Set(componentRefIdsFromData(data));
  const mains = carried.filter(
    (m): m is DesignComponent =>
      isValidDesignComponent(m) && used.has(m.id) && componentWithinBytes(m),
  );
  return componentUpsertLaterStatements(env, mains);
}
