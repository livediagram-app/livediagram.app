// The old MCP host guard (liveworkspace/docs/specs/021-mcp/mcp.md "What people are told", Work Tracker 1423): no page,
// help article, README, setup screen or listing names an app's old MCP host (`mcp.<app>.app`, staging
// `mcp-staging.<app>.app`), where a person would copy it and connect the wrong thing. Only what routes or explains
// the old hosts may: the MCP Worker, tests, the migration note, specs and the developer docs. It reads the files git
// tracks, so every group's Checks job runs it, whatever the change touched.
//
//   node .github/scripts/old-mcp-host-guard.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const OLD_HOST = /mcp(?:-staging)?\.live(?:diagram|planner|documents|design|knowledge)\.app/;

// Text a person or a client can read; everything else (images, fonts, lockfiles) cannot name an address.
const TEXT = /\.(?:tsx?|jsx?|mjs|json|mdx?|toml|ya?ml|txt|html|css|example)$/;

/** Files allowed to name an old host, each for a reason. */
export const ALLOWED = [
  // The Worker that serves the old hosts, its routes and its tests.
  /^liveworkspace\/apps\/mcp\//,
  // Tests assert on them: refusals, redirects and fixtures.
  /\.test\.(?:tsx?|mjs)$/,
  // The migration note, written once for every Build with AI page and every help article.
  /^packages\/marketing-site\/src\/components\/ai\/AiTroubleshooting\.tsx$/,
  /^liveworkspace\/apps\/help\/app\/account-and-data\/connect-ai-mcp\/(?:ai-clients\/)?page\.mdx$/,
  // Developer docs and specs: where the old hosts are routed and why.
  /^docs\/(?:migration|structure)\.md$/,
  /^(?:[a-z]+\/)?docs\/(?:specs|research|development)\//,
  // Recordings of other sites' pages, kept as fixtures.
  /^packages\/agent-markdown\//,
];

/**
 * The tracked paths that name an old host outside the allow-list.
 * @param {string[]} files tracked paths, relative to the root
 * @param {(file: string) => string} read
 */
export function findOldHosts(files, read) {
  return files
    .filter((file) => TEXT.test(file) && !ALLOWED.some((allowed) => allowed.test(file)))
    .filter((file) => OLD_HOST.test(read(file)));
}

function main() {
  const files = execFileSync('git', ['ls-files', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean);
  const hits = findOldHosts(files, (file) => {
    try {
      return readFileSync(path.join(ROOT, file), 'utf8');
    } catch {
      // Deleted in the working tree but still in the index: nothing to read.
      return '';
    }
  });
  if (hits.length === 0) return;
  console.error(
    'Files naming an app\'s old MCP host (liveworkspace/docs/specs/021-mcp/mcp.md "What people are told"):\n' +
      hits.map((h) => `  ${h}`).join('\n') +
      '\n\nName the one address, https://mcp.liveworkspace.app/mcp, instead.',
  );
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
