// Drives a product's MCP server over JSON-RPC (streamable HTTP), so an evaluating agent that cannot mount a new MCP
// server mid-session still calls exactly the tools a real assistant would. Each product's eval/mcp-call.mjs hands in
// its folder (token.env and runs/ sit beside it), the environment variable its token is read from and its local MCP.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { connect } from './mcp-client.mjs';

/**
 * Runs the command line's call, and exits 1 when it fails.
 * @param {{ here: string, tokenEnv: string, mcpUrl: string }} product
 */
export function mcpCallMain({ here, tokenEnv, mcpUrl }) {
  const URL_ = process.env.MCP_URL ?? mcpUrl;
  const LOG = process.env.EVAL_LOG ?? join(here, 'runs', 'calls.jsonl');
  const IMG_DIR = process.env.EVAL_IMG_DIR ?? join(here, 'runs', 'shots');

  function token() {
    if (process.env[tokenEnv]) return process.env[tokenEnv];
    const file = join(here, 'token.env');
    if (!existsSync(file))
      throw new Error(`No token: set ${tokenEnv} or write TOKEN=lwt_… to eval/token.env`);
    const line = readFileSync(file, 'utf8')
      .split('\n')
      .find((l) => l.startsWith('TOKEN='));
    if (!line) throw new Error('eval/token.env has no TOKEN= line');
    return line.slice('TOKEN='.length).trim();
  }

  async function main() {
    const [what, ...rest] = process.argv.slice(2);
    if (!what)
      throw new Error(
        "usage: mcp-call.mjs instructions | tools [<name> ...] | <tool> '<json args>'",
      );
    const client = await connect({ url: URL_, token: token() });
    if (what === 'instructions') return console.log(client.instructions);
    if (what === 'tools') {
      for (const t of await client.tools()) {
        if (rest.length && !rest.includes(t.name)) continue;
        console.log(
          rest.length
            ? JSON.stringify({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema,
              })
            : `${t.name}: ${t.description.slice(0, 160)}`,
        );
      }
      return;
    }
    const args = rest[0] ? JSON.parse(rest[0]) : {};
    const started = Date.now();
    const out = await client.call(what, args);
    mkdirSync(dirname(LOG), { recursive: true });
    appendFileSync(
      LOG,
      JSON.stringify({
        tool: what,
        args,
        isError: !out?.content || !!out.isError,
        ms: Date.now() - started,
      }) + '\n',
    );
    if (!out?.content) return console.log(JSON.stringify(out, null, 1));
    for (const c of out.content) {
      if (c.type === 'text') console.log(c.text);
      else if (c.type === 'image') {
        mkdirSync(IMG_DIR, { recursive: true });
        const file = join(IMG_DIR, `${what}-${Date.now()}.png`);
        writeFileSync(file, Buffer.from(c.data, 'base64'));
        console.log(`[image saved: ${file}]`);
      } else console.log(`[${c.type} omitted]`);
    }
    if (out.isError) console.log('(tool error)');
  }

  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
