// The person's livehuddle Spaces, theirs and their teams', for Settings › Calls and the Start a Call popover
// (liveworkspace/docs/specs/004-index/item-calls.md "Your Calls Space", "The Start a Call popover"). Each keeps the ones
// the person may choose (choosableSpaces). Apart from the Settings host so the popover's chunk loads none of Settings.
import { CALL_SPACES_LISTED, type Item } from '@liveworkspace/index-client';
import { indexClient } from '../../lib/index-client';

type Lister = Pick<typeof indexClient, 'listItems'>;

/** One read of the person's Spaces, as the index lists them. */
export const listCallSpaces = async (lister: Lister = indexClient): Promise<Item[]> =>
  (await lister.listItems({ app: 'livehuddle', view: 'all', limit: CALL_SPACES_LISTED })).items;
