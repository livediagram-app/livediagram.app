// The first-load guard (liveworkspace/docs/specs/013-export/vector-pdf.md "Performance"): static imports of the writers are found,
// dynamic ones, type imports, tests and build output are not.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { staticLazyImports, staticSpecifiers } from './lazy-guard';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('staticSpecifiers', () => {
  it('reads imports and re-exports, leaving out type imports and dynamic ones', () => {
    const code = [
      "import { a } from 'one';",
      "import type { B } from 'two';",
      'export { c } from "three";',
      "  import d from 'four'",
      "const e = await import('five');",
      "import 'side-effect';",
    ].join('\n');
    expect(staticSpecifiers(code)).toEqual(['one', 'three', 'four']);
  });
});

describe('staticLazyImports', () => {
  it('names each app file that imports a writer statically', () => {
    const app = mkdtempSync(join(tmpdir(), 'lazy-guard-'));
    dirs.push(app);
    const put = (rel: string, code: string) => {
      mkdirSync(join(app, rel, '..'), { recursive: true });
      writeFileSync(join(app, rel), code);
    };
    put('lib/ok.ts', "const w = () => import('@liveworkspace/vector-export/pdf');");
    put('lib/bad.ts', "import { svgPagesToPdf } from '@liveworkspace/vector-export/pdf';");
    put('components/Bad.tsx', "import * as fontkit from 'fontkit';");
    put('components/types.ts', "import type { Fontkit } from 'fontkit';");
    put('lib/bad.test.ts', "import 'fontkit'; import x from 'fontkit';");
    put('lib/node_modules/x.ts', "import x from 'fontkit';");
    put('lib/.hidden/x.ts', "import x from 'fontkit';");
    put('lib/notes.md', "import x from 'fontkit';");
    const { files, offenders } = staticLazyImports(app, ['lib', 'components', 'missing']);
    expect(files).toBe(4);
    expect(offenders.sort()).toEqual(['components/Bad.tsx', 'lib/bad.ts']);
  });
});
