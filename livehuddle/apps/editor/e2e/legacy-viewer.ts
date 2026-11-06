import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { APIRequestContext } from '@playwright/test';

// A Viewer link as one made before livehuddle stopped offering them (docs/specs/013-workspace/share-roles.md "Legacy
// Viewer links"): the api and the index refuse a new one, so the spec makes a Participant link and lowers it to
// `view` in the e2e stack's own index D1 (scripts/e2e-stack.mjs INDEX_STATE), as a link stored before would read.
const INDEX_DIR = path.resolve(import.meta.dirname, '../../../../liveworkspace/apps/index');
const INDEX_STATE = path.join(INDEX_DIR, '.wrangler', 'e2e-state');
const LOWER_ATTEMPTS = 3;

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
  // The stack's own index Worker writes the same SQLite file all the while (four workers in parallel in CI), and a
  // write from outside it has failed once in CI and passed on the retry: try again a few times before failing, and
  // fail with what wrangler said (it was swallowed before).
  const command = `UPDATE share_links SET level = 'view' WHERE code = '${code}'`;
  for (let attempt = 1; ; attempt++) {
    try {
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
          command,
        ],
        { cwd: INDEX_DIR, stdio: 'pipe' },
      );
      break;
    } catch (error) {
      if (attempt >= LOWER_ATTEMPTS) {
        const output = error as { stderr?: Buffer; stdout?: Buffer };
        throw new Error(
          `lowering ${code} to view failed ${attempt} times: ${String(output.stderr ?? '')}${String(output.stdout ?? '')}`,
          { cause: error },
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
  return code;
}
