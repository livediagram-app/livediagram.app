// Opening a plan through a share link (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Sharing and access"). The link
// is the index's: its grant on the plan says what the link allows (the level, and the tab it is scoped to), and
// the plan is then read with that grant. A Community post's link (docs/specs/025-community/community.md "Viewing a
// post's plan") also carries its post, which the api says on `GET /api/share/<code>`. Managing links is the shared
// Explorer's Share dialog (@liveworkspace/explorer `ShareDialog`), straight to the index.
import { IndexError } from '@liveworkspace/index-client';
import {
  parseStoredLevel,
  type CommunityShareInfo,
  type ProjectResponse,
} from '@liveplanner/api-schema';
import { readCommunityShareInfo } from '@liveworkspace/community-ui/editor';
import { dedupeInFlight } from '@liveworkspace/workbench/lib/dedupe';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import {
  API_BASE,
  apiHeaders,
  expectOkOrNull,
  getSessionSharePassword,
  type SharedProjectResolution,
  apiFetch,
} from './core';
import { planGrant, planGrantRefusal } from './plan-grants';

// A refusal the password gate answers: none sent yet (401) or a wrong one (403).
function passwordRefusal(code: string | null): SharedProjectResolution | null {
  if (code === 'password_required') return { passwordRequired: true, invalid: false };
  if (code === 'password_invalid') return { passwordRequired: true, invalid: true };
  return null;
}

// Resolve a share code to the plan it opens, the level it grants and its tab. With the plan's id (the address
// `/project/<id>?s=<code>` carries it) this is the grant, which the page asked for while its code loaded, and the
// plan's one read; without it, the index resolves the code first. Null for a code that opens nothing.
async function _apiLoadShared(
  code: string,
  ownerId: string,
  projectId: string | null = null,
): Promise<SharedProjectResolution | null> {
  const password = getSessionSharePassword();
  let planId = projectId;
  if (!planId) {
    try {
      planId = (await indexClient.resolveShare(code, password)).item.id;
    } catch (err) {
      if (err instanceof IndexError) return passwordRefusal(err.code);
      throw err;
    }
  }
  const share = { code, password };
  const grant = await planGrant(planId, share, { fresh: true });
  if (!grant) return passwordRefusal(planGrantRefusal(planId, share));
  // A community link is a view link to every tab, so only such a link can be one: its post is asked beside the read.
  const maybeCommunity = grant.level === 'view' && grant.tabId === null;
  const [res, community] = await Promise.all([
    apiFetch(`${API_BASE}/projects/${encodeURIComponent(planId)}`, {
      headers: await apiHeaders(ownerId, { share: code }),
    }),
    maybeCommunity ? apiLoadCommunityPostOf(code, ownerId) : Promise.resolve(null),
  ]);
  const body = await expectOkOrNull<ProjectResponse>(res, 'load shared');
  if (!body) return null;
  return {
    project: body.project,
    role: parseStoredLevel(grant.level),
    tabId: grant.tabId,
    community,
  };
}

// The Community post a link belongs to, or null for an ordinary link or when it can't be read (the link then opens as
// an ordinary view link, which the api already serves redacted when it is a community one).
async function apiLoadCommunityPostOf(
  code: string,
  ownerId: string,
): Promise<CommunityShareInfo | null> {
  try {
    const res = await apiFetch(`${API_BASE}/share/${encodeURIComponent(code)}`, {
      headers: await apiHeaders(ownerId, { share: null }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { community?: unknown };
    return readCommunityShareInfo(body.community);
  } catch {
    return null;
  }
}

export const apiLoadShared = dedupeInFlight<
  [code: string, ownerId: string, projectId?: string | null],
  SharedProjectResolution | null
>(_apiLoadShared, (code, ownerId, projectId) => `${code}|${ownerId}|${projectId ?? ''}`);
