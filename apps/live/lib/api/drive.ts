// The Google Drive mirror's calls to the api worker
// (docs/specs/022-drive-mirror/blueprints/drive-mirror.md, "Routes"). Signed-in
// only: apiHeaders attaches the Clerk Bearer, and the worker refuses anything
// else. The Drive traffic itself never touches the worker.

import type {
  DriveAccessToken,
  DriveConnection,
  DriveItem,
  DriveItemKind,
  DriveLease,
} from '@livediagram/api-schema';
import { API_BASE, apiDelete, apiFetch, apiHeaders, expectOk } from './core';

const base = `${API_BASE}/drive`;

export async function apiDriveState(ownerId: string, redirectUri: string): Promise<string> {
  const res = await apiFetch(`${base}/state`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({ redirectUri }),
  });
  return (await expectOk<{ state: string }>(res, 'drive state')).state;
}

export async function apiDriveConnect(
  ownerId: string,
  code: string,
  state: string,
): Promise<DriveConnection> {
  const res = await apiFetch(`${base}/connect`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({ code, state }),
  });
  return (await expectOk<{ connection: DriveConnection }>(res, 'drive connect')).connection;
}

export async function apiDriveToken(ownerId: string): Promise<DriveAccessToken> {
  const res = await apiFetch(`${base}/token`, {
    method: 'POST',
    headers: await apiHeaders(ownerId),
  });
  return expectOk<DriveAccessToken>(res, 'drive token');
}

export async function apiGetDriveConnection(ownerId: string): Promise<DriveConnection | null> {
  const res = await apiFetch(`${base}/connection`, { headers: await apiHeaders(ownerId) });
  return (await expectOk<{ connection: DriveConnection | null }>(res, 'drive connection'))
    .connection;
}

export async function apiPutDriveConnection(
  ownerId: string,
  patch: { rootFolderId?: string | null; pageToken?: string },
): Promise<DriveConnection> {
  const res = await apiFetch(`${base}/connection`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(patch),
  });
  return (await expectOk<{ connection: DriveConnection }>(res, 'drive connection update'))
    .connection;
}

export async function apiDisconnectDrive(ownerId: string): Promise<void> {
  await apiDelete(`${base}/connection`, ownerId, { action: 'drive disconnect' });
}

export async function apiListDriveItems(ownerId: string): Promise<DriveItem[]> {
  const res = await apiFetch(`${base}/items`, { headers: await apiHeaders(ownerId) });
  return (await expectOk<{ items: DriveItem[] }>(res, 'drive items')).items;
}

export async function apiPutDriveItems(ownerId: string, items: DriveItem[]): Promise<void> {
  const res = await apiFetch(`${base}/items`, {
    method: 'PUT',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({ items }),
  });
  await expectOk<{ items: DriveItem[] }>(res, 'drive items update');
}

export async function apiDeleteDriveItem(
  ownerId: string,
  kind: DriveItemKind,
  ldId: string,
): Promise<void> {
  await apiDelete(`${base}/items/${kind}/${encodeURIComponent(ldId)}`, ownerId, {
    action: 'drive item delete',
  });
}

export async function apiAcquireDriveLease(ownerId: string, holder: string): Promise<DriveLease> {
  const res = await apiFetch(`${base}/lease`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify({ holder }),
  });
  return expectOk<DriveLease>(res, 'drive lease');
}

export async function apiReleaseDriveLease(ownerId: string, holder: string): Promise<void> {
  await apiDelete(`${base}/lease?holder=${encodeURIComponent(holder)}`, ownerId, {
    action: 'drive lease release',
  });
}
