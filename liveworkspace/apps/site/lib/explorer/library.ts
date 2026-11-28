'use client';

// The Library on liveworkspace.app's Explorer: each app's Image Gallery, Shape Libraries and Walkthroughs, read from
// the app's API by the workspace token (@liveworkspace/explorer's appLibraryHosts). An app without one has no such page.
// In no app the Library is every app's (everyAppLibraryHosts, Work Tracker 1493): the one Image Gallery, Shape
// Libraries where an app keeps them, and every app's Walkthroughs, never only the last app's.

import {
  appLibraryHosts,
  everyAppLibraryHosts,
  type AppLibraryHosts,
} from '@liveworkspace/explorer';
import type { AppName } from '@liveworkspace/sites';
import { appOrigin } from './page-app';
import { workspaceToken } from './token';

/** The app's Library hosts (stable per app), or none for a page it keeps none of. */
export const libraryHosts = (app: AppName): AppLibraryHosts =>
  appLibraryHosts(app, { token: workspaceToken, origin: appOrigin(app) });

/** The Library in no app: every app's, read through `prefer` (the last app) first where it keeps a page (stable per
 *  app). */
export const everyAppLibrary = (prefer: AppName): AppLibraryHosts =>
  everyAppLibraryHosts(prefer, { token: workspaceToken, originOf: appOrigin });
