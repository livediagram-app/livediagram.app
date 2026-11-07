// Where the Community lives on livehuddle's site (docs/specs/025-community/community.md "Where it lives"): the paths
// every app's site shares (@liveworkspace/community/paths), kept apart from the rest of the Community vocabulary so a
// link to it (the apps menu, the footer, the editor's Community bar) never loads the categories, limits and validation
// with it.

import { communityKeyStorage } from '@liveworkspace/community/paths';

export {
  COMMUNITY_HOME_PATH,
  communityImagePath,
  communityPostPath,
} from '@liveworkspace/community/paths';

// Where the Community page keeps its per-browser key on livehuddle's address (liveworkspace/docs/specs/007-community/
// community.md "Likes").
export const COMMUNITY_KEY_STORAGE = communityKeyStorage('livehuddle');
