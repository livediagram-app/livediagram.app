// A person's default folders (docs/specs/013-workspace/default-folders.md "API"): read, set and
// cleared. Owner-scoped, guests included (apiHeaders attaches the Clerk token when signed in, else
// the X-Owner-Id header). Every refusal throws ApiError with its token as `code`.
import type { PlacementDefault, PlacementDefaultKey } from '@livediagram/api-schema';
import { API_BASE, apiDelete, apiFetch, apiHeaders, expectOk, expectOkVoid } from './core';

const defaultUrl = (key: PlacementDefaultKey) =>
  `${API_BASE}/placement-defaults/${encodeURIComponent(key)}`;

export async function apiListPlacementDefaults(ownerId: string): Promise<PlacementDefault[]> {
  const res = await apiFetch(`${API_BASE}/placement-defaults`, {
    headers: await apiHeaders(ownerId),
  });
  const { defaults } = await expectOk<{ defaults: PlacementDefault[] }>(
    res,
    'list placement defaults',
  );
  return defaults;
}

export async function apiSetPlacementDefault(
  ownerId: string,
  key: PlacementDefaultKey,
  folderId: string,
): Promise<void> {
  const res = await apiFetch(defaultUrl(key), {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({ folderId }),
  });
  await expectOkVoid(res, 'set placement default');
}

export async function apiClearPlacementDefault(
  ownerId: string,
  key: PlacementDefaultKey,
): Promise<void> {
  return apiDelete(defaultUrl(key), ownerId, { action: 'clear placement default' });
}
