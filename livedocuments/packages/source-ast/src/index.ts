import { join } from 'node:path';
import type { SourceFile } from 'typescript/unstable/ast';
import { API } from 'typescript/unstable/sync';

// The repo's static guards read its own TypeScript (docs/specs/003-system-architecture/source-scanners.md).
// TypeScript 7 parses in its native compiler, reached through its API: the files are opened as one
// throwaway project whose tsconfig exists only in memory, and the compiler hands back their trees.

/** The project's tsconfig: just the files, no lib, no imports followed, nothing type-checked. */
const projectConfig = (paths: readonly string[]) =>
  JSON.stringify({
    compilerOptions: { noLib: true, noResolve: true, types: [], jsx: 'preserve', allowJs: true },
    files: paths,
  });

/**
 * Parses each file on disk into a TypeScript syntax tree, in the order given. Every node knows its
 * parent; `.tsx` files parse as JSX. One compiler process serves the whole batch.
 */
export function parseSourceFiles(paths: readonly string[]): SourceFile[] {
  if (paths.length === 0) return [];
  const tsconfig = join(process.cwd(), '.source-ast.tsconfig.json');
  const api = new API({
    cwd: process.cwd(),
    fs: { readFile: (file) => (file === tsconfig ? projectConfig(paths) : undefined) },
  });
  try {
    const project = api.updateSnapshot({ openProjects: [tsconfig] }).getProject(tsconfig);
    if (!project) throw new Error('[source-ast] the compiler opened no project for the files');
    return paths.map((path) => {
      const sourceFile = project.program.getSourceFile(path);
      if (!sourceFile) throw new Error(`[source-ast] the compiler did not parse ${path}`);
      return sourceFile;
    });
  } finally {
    api.close();
  }
}
