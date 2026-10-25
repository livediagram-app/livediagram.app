// One changeset write (docs/specs/015-api/blueprints/cli.md "Writes"): the shared write
// (@liveworkspace/agent-verbs/write), bound to this product's collection, CLI, read copies and changeset types.

import { createWrite, type WriteFlags } from '@liveworkspace/agent-verbs/write';
import {
  CHANGESET_SUMMARY_MAX,
  type ChangesetRequest,
  type ChangesetResponse,
} from '@livedesign/api-schema';
import { AGENT_PRODUCT } from './agent-product';
import { baseFromCopy, recordCopy } from './copies';
import type { VerbContext } from './define';

export { HELD_RETRY_INTERVAL_MS, type WriteFlags } from '@liveworkspace/agent-verbs/write';

const write = createWrite({
  product: AGENT_PRODUCT,
  baseFromCopy,
  recordCopy,
  summaryMax: CHANGESET_SUMMARY_MAX,
});

export const { writeFlags } = write;

type WriteTarget = { designId: string; tabId: string; tabName: string; doc: string };

export function submitChangeset(
  ctx: VerbContext,
  target: WriteTarget,
  body: Pick<ChangesetRequest, 'operations' | 'replace'>,
  flags: WriteFlags,
): Promise<ChangesetResponse> {
  const { designId: fileId, tabId, tabName, doc: ref } = target;
  return write.submitChangeset<ChangesetResponse>(
    ctx,
    { fileId, tabId, tabName, ref },
    body,
    flags,
  );
}
