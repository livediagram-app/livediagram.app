// The one address stays the only address (liveworkspace/docs/specs/021-mcp/mcp.md "The app MCPs fold in", Work
// Tracker 1423): no page, help article, README, setup screen or listing names an app's old MCP host
// (`mcp.<app>.app`, staging `mcp-staging.<app>.app`), where a person would copy it and connect the wrong thing.
// Only what routes or explains the old hosts may: this Worker, the migration note, the developer docs and specs,
// tests, and recordings of other sites' pages. A new mention elsewhere fails here.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const OLD_HOST = /mcp(?:-staging)?\.live(?:diagram|planner|documents|design|knowledge)\.app/;

// Text a person or a client can read; everything else (images, fonts, lockfiles) cannot name an address.
const TEXT = /\.(?:tsx?|jsx?|mjs|json|mdx?|toml|ya?ml|txt|html|css|example)$/;

/** Files allowed to name an old host, each for a reason. */
const ALLOWED: readonly RegExp[] = [
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

function trackedTextFiles(): { root: string; files: string[] } {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: import.meta.dirname,
    encoding: 'utf8',
  }).trim();
  const listed = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return { root, files: listed.split('\0').filter((file) => TEXT.test(file)) };
}

describe('the old per-app MCP hosts', () => {
  it('are named nowhere a person would copy one', () => {
    const { root, files } = trackedTextFiles();
    expect(files.length).toBeGreaterThan(1000);
    const offenders = files
      .filter((file) => !ALLOWED.some((allowed) => allowed.test(file)))
      .filter((file) => {
        try {
          return OLD_HOST.test(readFileSync(join(root, file), 'utf8'));
        } catch {
          return false;
        }
      });
    expect(offenders, 'name the one address, https://mcp.liveworkspace.app/mcp, instead').toEqual(
      [],
    );
  });

  it('are matched in both production and staging spellings', () => {
    expect(OLD_HOST.test('https://mcp.livediagram.app/mcp')).toBe(true);
    expect(OLD_HOST.test('https://mcp-staging.liveplanner.app/mcp')).toBe(true);
    expect(OLD_HOST.test('https://mcp.liveworkspace.app/mcp')).toBe(false);
    expect(OLD_HOST.test('https://mcp-staging.liveworkspace.app/mcp')).toBe(false);
  });
});
