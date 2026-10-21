// Custom-theme calls (docs/specs/011-theme/custom-themes.md): list / create / update / delete. Owner-
// scoped like folders; guests included (apiHeaders attaches the Clerk
// token when signed in, else the X-Owner-Id header).
import type { CustomTheme, CustomThemeDefinition } from '@livediagram/api-schema';
import { dedupeInFlight } from '../dedupe';
import {
  API_BASE,
  apiDelete,
  apiHeaders,
  expectOk,
  type CustomThemeResponse,
  type CustomThemesResponse,
  apiFetch,
} from './core';

// Deduped like apiListFolders: the editor boot hook and an open
// Explorer Themes pane can both ask for the list on the same ownerId.
async function _apiListCustomThemes(ownerId: string): Promise<CustomTheme[]> {
  const res = await apiFetch(`${API_BASE}/custom-themes`, { headers: await apiHeaders(ownerId) });
  const { themes } = await expectOk<CustomThemesResponse>(res, 'list custom themes');
  return themes;
}
export const apiListCustomThemes = dedupeInFlight(_apiListCustomThemes, (ownerId) => ownerId);

export async function apiCreateCustomTheme(
  ownerId: string,
  input: { id: string; name: string; definition: CustomThemeDefinition },
): Promise<CustomTheme> {
  const res = await apiFetch(`${API_BASE}/custom-themes`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(input),
  });
  const { theme } = await expectOk<CustomThemeResponse>(res, 'create custom theme');
  return theme;
}

export async function apiUpdateCustomTheme(
  ownerId: string,
  id: string,
  patch: { name?: string; definition?: CustomThemeDefinition },
): Promise<CustomTheme> {
  const res = await apiFetch(`${API_BASE}/custom-themes/${id}`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(patch),
  });
  const { theme } = await expectOk<CustomThemeResponse>(res, 'update custom theme');
  return theme;
}

export async function apiDeleteCustomTheme(ownerId: string, id: string): Promise<void> {
  // Theme events are keyed under the 'account' source type (docs/specs/013-workspace/timeline.md §4.5).
  return apiDelete(`${API_BASE}/custom-themes/${id}`, ownerId, {
    action: 'delete custom theme',
    purge: { sourceType: 'account', sourceId: id },
  });
}
