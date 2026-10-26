'use client';

// After a team is made, joined, renamed, left or deleted in the Explorer (its TeamsHost's onTeamsChanged;
// liveworkspace/docs/specs/004-index/one-explorer.md "Teams are run in the Explorer"): the token is read again, so it names the
// person's teams as they now are, and the index lets them file into a team they just made. On an app's own address
// (page-app.ts) the app's session holds the token, so its cached account is dropped first.

import { forgetAppAccount } from './app-session';
import { pageApp } from './page-app';
import { resetWorkspaceIdentity, workspaceIdentity, type WorkspaceIdentity } from './token';

/** The identity with a freshly read token; null when it couldn't be read (the old one stays). */
export async function renewIdentity(): Promise<WorkspaceIdentity | null> {
  if (pageApp()) forgetAppAccount();
  resetWorkspaceIdentity();
  return workspaceIdentity();
}
