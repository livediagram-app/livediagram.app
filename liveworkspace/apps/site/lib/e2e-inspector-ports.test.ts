import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Each e2e stack's wrangler inspectors stay inside its own ports (scripts/e2e-stack/inspector-ports.mjs), so two
// stacks in neighbouring port blocks never collide. A stack that passed `port + 1000`, or no inspector at all
// (wrangler's 9229), opened a port outside its block.

const ROOT = resolve(__dirname, '../../../..');
const HELPER = resolve(ROOT, 'scripts/e2e-stack/inspector-ports.mjs');
const PRODUCTS = ['livediagram', 'livedesign', 'livedocuments', 'livehuddle', 'liveplanner'];

const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

describe('inspectorPortOf', () => {
  it('sits ten above its service unless the environment names one', async () => {
    const { inspectorPortOf } = (await import(/* @vite-ignore */ HELPER)) as {
      inspectorPortOf: (fromEnv: string | undefined, port: number) => number;
    };
    expect(inspectorPortOf(undefined, 3605)).toBe(3615);
    expect(inspectorPortOf('3606', 3605)).toBe(3606);
  });
});

describe.each(PRODUCTS)('%s e2e stack', (product) => {
  const source = read(`${product}/scripts/e2e-stack.mjs`);

  it('derives the index and api inspector ports from the helper', () => {
    expect(source).toContain('inspector-ports.mjs');
    expect(source).toContain('inspectorPortOf(process.env.E2E_INDEX_INSPECTOR_PORT, INDEX_PORT)');
    expect(source).toContain('inspectorPortOf(process.env.E2E_API_INSPECTOR_PORT, API_PORT)');
  });

  it('passes an inspector port to every wrangler dev and never port + 1000', () => {
    const wranglerDevs = source.split("'dev',").length - 1;
    expect(source.split("'--inspector-port',").length - 1).toBe(wranglerDevs);
    expect(source).not.toMatch(/\+ 1000/);
  });
});

describe('the media service', () => {
  it('takes an inspector port and defaults it beside its own port', () => {
    const source = read('liveworkspace/apps/media/scripts/e2e-media.mjs');
    expect(source).toContain('inspectorPort = port + 10');
    expect(source).not.toMatch(/\+ 1000/);
  });
});
