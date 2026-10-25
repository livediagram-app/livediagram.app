// The central index (liveworkspace/docs/one-explorer-contracts.md), reached on this site's own origin: the router
// forwards `/api/index/*` to liveworkspace.app, so there is no CORS and no liveworkspace cookie. The person's Bearer
// is the account's access token when signed in, else the guest token (the product's `currentBearer`, through the `api` binding).
import { createIndexClient, type IndexClient } from '@liveworkspace/index-client';
import { API_BASE } from './api/base';
import { workbench } from '../bindings';

export const INDEX_BASE = `${API_BASE}/index`;

export const indexClient: IndexClient = createIndexClient({
  baseUrl: INDEX_BASE,
  getToken: () => workbench.api.currentBearer(),
});
