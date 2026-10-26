'use client';

// Teams in the editor's Explorer panel (liveworkspace/docs/specs/004-index/one-explorer.md "Teams are run in the Explorer"): New Team
// on the rail and a team's Members dialog, over liveworkspace's account API through this app's router
// (`/api/workspace/account`), by the person's access token. The shared client (@liveworkspace/explorer
// createTeamsHost); the panel asks nothing until one of those opens.

import { createTeamsHost } from '@liveworkspace/explorer';
import { workbench } from '../bindings';

export const explorerTeamsHost = createTeamsHost({
  baseUrl: '/api/workspace/account',
  // The product's Bearer (the `api` binding), read when a request goes out.
  token: () => workbench.api.currentBearer(),
});
