'use client';

// The Library on liveworkspace.app's Explorer: each app's Image Gallery and Shape Libraries, read from the app's API
// by the workspace token (@liveworkspace/explorer's appLibraryHosts). An app without one has no such page.

import { appLibraryHosts, type AppLibraryHosts } from '@liveworkspace/explorer';
import type { AppName } from '@liveworkspace/sites';
import { workspaceToken } from './token';

/** The app's Library hosts (stable per app), or none for a page it keeps none of. */
export const libraryHosts = (app: AppName): AppLibraryHosts =>
  appLibraryHosts(app, { token: workspaceToken });
