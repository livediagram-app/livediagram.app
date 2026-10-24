'use client';

// Teams in the editor's Explorer panel (liveworkspace/docs/one-explorer.md "Teams are run in the Explorer"): New Team
// on the rail and a team's Members dialog, over liveworkspace's account API through this app's router
// (`/api/workspace/account`), by the person's access token. The shared client (@liveworkspace/explorer
// createTeamsHost); the panel asks nothing until one of those opens.

import { createTeamsHost } from '@liveworkspace/explorer';
import { currentBearer } from './api/core';

export const explorerTeamsHost = createTeamsHost({
  baseUrl: '/api/workspace/account',
  token: currentBearer,
});
