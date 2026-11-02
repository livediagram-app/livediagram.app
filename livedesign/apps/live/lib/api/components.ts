// The component library's calls (docs/specs/009-elements/components.md "Sharing, collaboration and storage"): read
// the mains a session may see, make one, and patch one element by element. A This Browser design keeps its library
// in its offline record instead.
import type { ComponentResponse, ComponentsResponse } from '@livedesign/api-schema';
import {
  isValidDesignComponent,
  type ComponentPatch,
  type DesignComponent,
} from '@livedesign/design';
import { isOfflineId, offlineLoadComponents, offlineSaveComponent } from '../offline/offline-store';
import { API_BASE, apiFetch, apiHeaders, expectOk, expectOkOrNull } from './core';

const base = (designId: string) => `${API_BASE}/designs/${designId}/components`;

/** The mains this session may see (a tab-scoped link: only those its tab uses). Archived ones included. */
export async function apiLoadComponents(
  ownerId: string,
  designId: string,
  shareCode: string | null,
): Promise<DesignComponent[]> {
  if (await isOfflineId(designId)) return offlineLoadComponents(designId);
  const res = await apiFetch(base(designId), {
    headers: await apiHeaders(ownerId, { share: shareCode }),
  });
  const body = await expectOkOrNull<ComponentsResponse>(res, 'load components');
  // A main that does not validate is skipped rather than drawn: its instances show as missing.
  return (body?.components ?? []).filter(isValidDesignComponent);
}

/** Makes (or replaces) one main; answers it as stored. */
export async function apiPutComponent(
  ownerId: string,
  designId: string,
  component: DesignComponent,
  shareCode: string | null,
): Promise<DesignComponent> {
  if (await isOfflineId(designId)) {
    await offlineSaveComponent(designId, component);
    return component;
  }
  return cloudPutComponent(ownerId, designId, component, shareCode);
}

/** The server half of apiPutComponent, whatever the offline index says: an Offline Mode sync writes the cloud copy's
 *  library while the id is still registered offline. */
export async function cloudPutComponent(
  ownerId: string,
  designId: string,
  component: DesignComponent,
  shareCode: string | null,
): Promise<DesignComponent> {
  const res = await apiFetch(`${base(designId)}/${encodeURIComponent(component.id)}`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
    body: JSON.stringify(component),
  });
  return (await expectOk<ComponentResponse>(res, 'save component')).component;
}

/** Changes one main by a patch, applied to the stored main element by element; answers it as stored. `local` is
 *  this editor's copy, which a This Browser design stores as it is. */
export async function apiPatchComponent(
  ownerId: string,
  designId: string,
  componentId: string,
  patch: ComponentPatch,
  shareCode: string | null,
  local: DesignComponent,
): Promise<DesignComponent> {
  if (await isOfflineId(designId)) {
    await offlineSaveComponent(designId, local);
    return local;
  }
  const res = await apiFetch(`${base(designId)}/${encodeURIComponent(componentId)}`, {
    method: 'PATCH',
    headers: await apiHeaders(ownerId, { share: shareCode, body: true }),
    body: JSON.stringify(patch),
  });
  return (await expectOk<ComponentResponse>(res, 'save component')).component;
}
