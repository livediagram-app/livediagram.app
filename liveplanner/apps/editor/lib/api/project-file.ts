// The plan's `.liveplanner` file (docs/specs/015-api/api.md `GET` / `POST /api/projects/:id/file`; blueprint
// plan-file.md): the Export dialog's Whole Plan downloads it, and the Import dialog's liveplanner Plan row makes a new
// plan from one. A new plan is the index's first, as every create is (apiCreateProject): its item and grant come back
// together, then the file is written into the plan with that grant; a write that fails takes the item away again,
// so nobody finds an empty plan.
import { INDEX_GRANT_HEADER } from '@liveplanner/api-schema';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { seedPlanGrant } from './plan-grants';
import { API_BASE, apiFetch, apiHeaders, expectOkVoid } from './core';

// The file's text, for an Editor of the whole plan; throws ApiError otherwise.
export async function apiExportProjectFile(ownerId: string, projectId: string): Promise<string> {
  const res = await apiFetch(`${API_BASE}/projects/${projectId}/file`, {
    headers: await apiHeaders(ownerId),
  });
  if (!res.ok) await expectOkVoid(res, 'export plan file');
  return res.text();
}

// A new plan of `ownerId`'s own from the file's text, named `title`; answers its id. Throws ApiError (its `code` the
// api's: `invalid_file`, `too_large`) or the index's error.
export async function apiImportProjectFile(
  ownerId: string,
  text: string,
  title: string,
): Promise<string> {
  const id = crypto.randomUUID();
  const { grant } = await indexClient.createItem({
    id,
    app: 'liveplanner',
    title,
    source: 'import',
  });
  seedPlanGrant(id, grant);
  try {
    const res = await apiFetch(`${API_BASE}/projects/${id}/file`, {
      method: 'POST',
      headers: {
        ...(await apiHeaders(ownerId, { body: true })),
        [INDEX_GRANT_HEADER]: grant.grant,
      },
      body: text,
    });
    await expectOkVoid(res, 'import plan file');
  } catch (err) {
    await indexClient.deleteItem(id, { permanent: true }).catch((gone: unknown) => {
      console.warn('[plan-file] new plan not deleted', { error: String(gone) });
    });
    throw err;
  }
  return id;
}
