'use client';

// The Library the editor lends the shared Explorer (@liveworkspace/explorer `LibraryHostProps`): the person's
// Walkthroughs, read through this site's own API with the page's Bearer (the package's `appLibraryHosts`, the same
// hosts liveworkspace.app's Explorer uses). liveplanner keeps no Image Gallery or Shape Libraries.

import { appLibraryHosts, type AppLibraryHosts } from '@liveworkspace/explorer';
import { currentBearer } from './api/core';

/** The Library over this site's API (same-origin paths), as the page's person (stable for the page's life). */
export const explorerLibrary: AppLibraryHosts = appLibraryHosts('liveplanner', {
  token: currentBearer,
  origin: '',
});
