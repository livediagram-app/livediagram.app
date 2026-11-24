import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Every app's write path names the agent that wrote (Work Tracker 1381): miss one and History silently shows the
// person. So each call of recordItemEditor in a product's api passes itemAgentOf, and each API client's create
// (createItemGrant) names its agent too. Scans the products' api sources, never imports them.
const ROOT = join(__dirname, '../../..');

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(path);
  }
  return out;
}

const apis = readdirSync(ROOT)
  .filter((name) => name.startsWith('live'))
  .map((name) => join(ROOT, name, 'apps/api/src'))
  .filter((dir) => {
    try {
      return statSync(dir).isDirectory();
    } catch {
      return false;
    }
  });

// Each call of `fn` in `text`, from its name to its closing parenthesis.
function callsOf(text: string, fn: string): string[] {
  const out: string[] = [];
  for (let at = text.indexOf(`${fn}(`); at >= 0; at = text.indexOf(`${fn}(`, at + 1)) {
    let depth = 0;
    let end = at + fn.length;
    for (; end < text.length; end++) {
      if (text[end] === '(') depth++;
      else if (text[end] === ')' && --depth === 0) break;
    }
    out.push(text.slice(at, end + 1));
  }
  return out;
}

describe("every app's write path names its agent", () => {
  it('finds the apps', () => {
    expect(apis.length).toBeGreaterThanOrEqual(6);
  });

  it('passes itemAgentOf to every recordItemEditor and createItemGrant call', () => {
    const missing: string[] = [];
    let seen = 0;
    for (const file of apis.flatMap((dir) => sources(dir))) {
      const text = readFileSync(file, 'utf8');
      for (const fn of ['recordItemEditor', 'createItemGrant'])
        for (const call of callsOf(text, fn)) {
          seen++;
          if (!call.includes('itemAgentOf(')) missing.push(`${file.slice(ROOT.length + 1)}: ${fn}`);
        }
    }
    expect(missing).toEqual([]);
    expect(seen).toBeGreaterThanOrEqual(12);
  });
});
