// The bounds an item write is held to beyond the store's own (@liveplanner/items write-checks.ts). With Pro off an
// attachment may state no more than the 10 MiB a picture could be before Pro, exactly as it always was; with Pro on
// the store's own bound stands (the most any tier's upload may be), and the images route holds each upload to its
// tier.
import { ITEM_ATTACHMENT_BYTES_LEGACY, type ItemWriteBounds } from '@liveplanner/items';
import { proEnabled } from '@liveworkspace/subscription';
import type { Env } from '../types';

const LEGACY: ItemWriteBounds = { attachmentBytesMax: ITEM_ATTACHMENT_BYTES_LEGACY };

export function itemWriteBounds(env: Pick<Env, 'PRO_ENABLED'>): ItemWriteBounds | undefined {
  return proEnabled(env.PRO_ENABLED) ? undefined : LEGACY;
}
