// The Explorer's Library over this app's API: the Image Gallery (and any page the sites registry lists for
// livedesign), read with the person's Bearer (an account's access token, else the guest's) from where the api
// lives (lib/api/base.ts). One set for the page's life, so the Explorer's reads key on stable objects.
import { appLibraryHosts } from '@liveworkspace/explorer';
import { API_BASE } from '@liveworkspace/workbench/lib/api/base';
import { currentBearer } from './api/core';

export const explorerLibrary = appLibraryHosts('livedesign', {
  token: currentBearer,
  // Same origin by default (`/api`); a dev build pointed at another api reads the Library there.
  origin: API_BASE.replace(/\/api\/?$/, ''),
});
