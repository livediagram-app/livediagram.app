import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { APIRequestContext } from '@playwright/test';

// A Viewer link as one made before livehuddle stopped offering them (docs/specs/013-workspace/share-roles.md "Legacy
// Viewer links"): the api and the index refuse a new one, so the spec makes a Participant link and lowers it to
// `view` in the e2e stack's own index D1 (scripts/e2e-stack.mjs INDEX_STATE), as a link stored before would read.
const INDEX_DIR = path.resolve(import.meta.dirname, '../../../../liveworkspace/apps/index');
const INDEX_STATE = path.join(INDEX_DIR, '.wrangler', 'e2e-state');

export async function legacyViewerLink(
  request: APIRequestContext,
  apiBase: string,
  documentId: string,
  headers: Record<string, string>,
): Promise<string> {
  const share = await request.post(`${apiBase}/documents/${documentId}/share`, {
    headers,
    data: { role: 'participate' },
  });
  if (!share.ok()) throw new Error(`share: ${share.status()}`);
  const code = ((await share.json()) as { link: { code: string } }).link.code;
  // The code is the index's own alphabet (no quotes), so it is safe inside the statement.
  if (!/^[A-Z0-9]+$/.test(code)) throw new Error(`unexpected share code ${code}`);
  execFileSync(
    'corepack',
    [
      'pnpm',
      'exec',
      'wrangler',
      'd1',
      'execute',
      'liveworkspace-index',
      '--local',
      '--persist-to',
      INDEX_STATE,
      '--command',
      `UPDATE share_links SET level = 'view' WHERE code = '${code}'`,
    ],
    { cwd: INDEX_DIR, stdio: 'ignore' },
  );
  return code;
}
