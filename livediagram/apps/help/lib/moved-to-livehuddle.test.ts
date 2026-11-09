import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { movedToLivehuddle } from './moved-to-livehuddle';

// The stubs for the articles that moved to livehuddle (Work Tracker #650) send an old link to the same path in
// livehuddle's help, so that path has to be a real livehuddle article, or the redirect lands on a 404.

const APP_DIR = fileURLToPath(new URL('../app', import.meta.url));
const LIVEHUDDLE_APP_DIR = fileURLToPath(
  new URL('../../../../livehuddle/apps/help/app', import.meta.url),
);

const stubPaths = readdirSync(APP_DIR, { recursive: true })
  .map((p) => String(p).replaceAll('\\', '/'))
  .filter((p) => p.endsWith('/page.tsx'))
  .map((p) => p.slice(0, -'/page.tsx'.length))
  .filter((dir) =>
    readFileSync(`${APP_DIR}/${dir}/page.tsx`, 'utf8').includes('movedToLivehuddle('),
  );

describe('movedToLivehuddle', () => {
  it('points at the same path in livehuddle, noindex, with that page canonical', () => {
    const moved = movedToLivehuddle('palette/chairs', 'Chairs');
    expect(moved.href).toBe('https://www.livehuddle.app/help/palette/chairs/');
    expect(moved.metadata.robots).toEqual({ index: false, follow: true });
    expect(moved.metadata.alternates).toEqual({ canonical: moved.href });
    expect(moved.label).toBe("Chairs guide in livehuddle's help");
  });

  it('finds every stub (guard against this test going blind)', () => {
    expect(stubPaths.length).toBe(8);
  });

  it('names its own path in each stub, and livehuddle has an article there', () => {
    for (const dir of stubPaths) {
      const src = readFileSync(`${APP_DIR}/${dir}/page.tsx`, 'utf8');
      expect(src, dir).toContain(`movedToLivehuddle('${dir}',`);
      expect(existsSync(`${LIVEHUDDLE_APP_DIR}/${dir}/page.mdx`), dir).toBe(true);
    }
  });
});
