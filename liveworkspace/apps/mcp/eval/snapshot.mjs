// Records each app's MCP as a client sees it (its instructions and its tools/list, compacted as the Worker sends
// it) into eval/tools/, for the tool-pick eval and the naming test (liveworkspace/docs/specs/021-mcp/mcp.md "The
// tool-pick eval"). Run after an app's tools change: `corepack pnpm --filter @liveworkspace/mcp-service eval:snapshot`.
// Each app's server is built in its own vitest run (its TypeScript and its WASM renderer stubbed), never deployed.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..');
const APPS = ['livediagram', 'livedocuments', 'liveplanner', 'livedesign', 'liveknowledge'];

const probe = (out) => `
import { it, vi } from 'vitest';
vi.mock('./image-result', () => ({ imageResult: (v) => ({ content: [{ type: 'text', text: JSON.stringify(v) }], structuredContent: v }) }));
import { writeFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { compactToolList } from '@liveworkspace/mcp-kit/tool-list-compact';
import { buildServer } from './server';
it('snapshot', async () => {
  const server = buildServer({ API: { fetch: async () => Response.json({}) }, OAUTH_KV: {} });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  const client = new Client({ name: 'snapshot', version: '0' });
  await client.connect(a);
  const { tools } = await client.listTools();
  const body = compactToolList({ jsonrpc: '2.0', id: 1, result: { tools } });
  const kept = body.result.tools.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations }));
  writeFileSync(${JSON.stringify(out)}, JSON.stringify({ instructions: client.getInstructions() ?? '', tools: kept }));
});
`;

for (const app of APPS) {
  const dir = join(ROOT, app, 'apps', 'mcp');
  const file = join(dir, 'src', 'zz-eval-snapshot.test.ts');
  const out = join(HERE, 'tools', `${app}.raw.json`);
  writeFileSync(file, probe(out));
  try {
    execFileSync('corepack', ['pnpm', 'exec', 'vitest', 'run', 'src/zz-eval-snapshot.test.ts'], {
      cwd: dir,
      stdio: 'inherit',
    });
  } finally {
    rmSync(file, { force: true });
  }
  const { instructions, tools } = JSON.parse(readFileSync(out, 'utf8'));
  rmSync(out);
  writeFileSync(join(HERE, 'tools', `${app}.json`), `${JSON.stringify(tools)}\n`);
  writeFileSync(join(HERE, 'tools', `${app}.instructions.txt`), `${instructions}\n`);
  console.log(`${app}: ${tools.length} tools`);
}
