// Version history from the editor (docs/specs/006-document/version-history.md "API"): the Version History panel's
// reads and writes. Restore and Make a Copy are sent as the editor's front door, as a changeset revert is.
import {
  CLIENT_HEADER,
  type VersionCopyResponse,
  type VersionListResponse,
  type VersionRetentionInfo,
  type VersionNameResponse,
  type VersionReadResponse,
  type VersionRestoreResponse,
  type VersionSummary,
} from '@livedocuments/api-schema';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';

// The refusals the panel words itself, so they are not reported as faults.
const EXPECTED = new Set([
  'not_found',
  'too_many_names',
  'tab_busy',
  'elements_held',
  'invalid_name',
]);
const expected = (code: string | null) => code !== null && EXPECTED.has(code);

type Who = { ownerId: string; shareCode: string | null };

const versionsUrl = (documentId: string, tabId: string) =>
  `${API_BASE}/documents/${documentId}/tabs/${encodeURIComponent(tabId)}/versions`;
const versionUrl = (documentId: string, tabId: string, versionId: string) =>
  `${versionsUrl(documentId, tabId)}/${encodeURIComponent(versionId)}`;

const headers = (who: Who, json = false) =>
  apiHeaders(who.ownerId, {
    share: who.shareCode,
    body: json,
    extra: { [CLIENT_HEADER]: 'editor' },
  });

// What the server said of how long the owner's tier keeps automatic versions, beside the list it came with
// (docs/specs/006-document/version-history.md "With Pro on"). Kept by the list itself, so the list stays the plain
// array every caller reads.
const RETENTION = new WeakMap<readonly VersionSummary[], VersionRetentionInfo>();

/** The retention a version list was answered with, or null: Pro off, or a tier not known. */
export function versionRetentionOf(
  versions: readonly VersionSummary[],
): VersionRetentionInfo | null {
  return RETENTION.get(versions) ?? null;
}

export async function apiListVersions(
  who: Who,
  documentId: string,
  tabId: string,
): Promise<VersionSummary[]> {
  const res = await apiFetch(versionsUrl(documentId, tabId), { headers: await headers(who) });
  const { versions, retention } = await expectOk<VersionListResponse>(
    res,
    'list versions',
    expected,
  );
  if (retention) RETENTION.set(versions, retention);
  return versions;
}

export async function apiReadVersion(
  who: Who,
  documentId: string,
  tabId: string,
  versionId: string,
): Promise<VersionReadResponse> {
  const res = await apiFetch(versionUrl(documentId, tabId, versionId), {
    headers: await headers(who),
  });
  return expectOk<VersionReadResponse>(res, 'read version', expected);
}

// Name This Version: the tab's content as it is now, kept under `name`.
export async function apiNameCurrentVersion(
  who: Who,
  documentId: string,
  tabId: string,
  name: string,
): Promise<VersionSummary> {
  const res = await apiFetch(versionsUrl(documentId, tabId), {
    method: 'POST',
    headers: await headers(who, true),
    body: JSON.stringify({ name }),
  });
  return (await expectOk<VersionNameResponse>(res, 'name version', expected)).version;
}

// A name given, changed or (null) taken off.
export async function apiRenameVersion(
  who: Who,
  documentId: string,
  tabId: string,
  versionId: string,
  name: string | null,
): Promise<VersionSummary> {
  const res = await apiFetch(`${versionUrl(documentId, tabId, versionId)}/name`, {
    method: 'PUT',
    headers: await headers(who, true),
    body: JSON.stringify({ name }),
  });
  return (await expectOk<VersionNameResponse>(res, 'rename version', expected)).version;
}

export async function apiRestoreVersion(
  who: Who,
  documentId: string,
  tabId: string,
  versionId: string,
): Promise<VersionRestoreResponse['restored']> {
  const res = await apiFetch(`${versionUrl(documentId, tabId, versionId)}/restore`, {
    method: 'POST',
    headers: await headers(who),
  });
  return (await expectOk<VersionRestoreResponse>(res, 'restore version', expected)).restored;
}

export async function apiCopyVersion(
  who: Who,
  documentId: string,
  tabId: string,
  versionId: string,
  name: string,
): Promise<VersionCopyResponse['tab']> {
  const res = await apiFetch(`${versionUrl(documentId, tabId, versionId)}/copy`, {
    method: 'POST',
    headers: await headers(who, true),
    body: JSON.stringify({ name }),
  });
  return (await expectOk<VersionCopyResponse>(res, 'copy version', expected)).tab;
}
