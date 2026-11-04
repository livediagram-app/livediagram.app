// Making an item an editor then fills (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "A create that
// resumes"). The index makes the item first and the app's api its content, both under ids the editor minted. When the
// content's create fails, a Retry sends the same ids again and the index answers 409 `item_exists` for an item that is
// the caller's own: its edit grant carries the create on, so the Retry finishes it rather than failing again.
import { IndexError, type IndexClient } from './client';
import type { CreateItemInput, GrantResponse } from './types';

export type CreatedOrResumed = {
  grant: GrantResponse;
  // The title the index filed it under; a resumed create keeps the one it asked for.
  title: string;
};

/** Makes the item, or takes up one this caller already made under the same id. Throws the create's error when the
 *  item is not theirs to edit (a grant below `edit`, or none), and on any other refusal without asking for a grant. */
export async function createOrResumeItem(
  client: Pick<IndexClient, 'createItem'>,
  input: CreateItemInput & { id: string },
  grantOf: (itemId: string) => Promise<GrantResponse | null>,
): Promise<CreatedOrResumed> {
  try {
    const { item, grant } = await client.createItem(input);
    return { grant, title: item.title };
  } catch (err) {
    if (!(err instanceof IndexError && err.status === 409 && err.code === 'item_exists')) throw err;
    const grant = await grantOf(input.id);
    if (grant?.level !== 'edit') throw err;
    return { grant, title: input.title ?? '' };
  }
}
