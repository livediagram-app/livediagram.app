import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Lints scratch files with the shared config, the way a workspace does: a throwaway directory
// holding an `oxlint.config.ts` that re-exports ./index.ts, linted by the oxlint binary.

// An unused disable directive is reported with no rule.
export type Finding = { file: string; rule: string | undefined; message: string; line: number };

type Diagnostic = {
  code?: string;
  message: string;
  filename: string;
  labels: { span: { line: number } }[];
};

const CONFIG = fileURLToPath(new URL('./index.ts', import.meta.url));
const OXLINT = join(
  dirname(createRequire(import.meta.url).resolve('oxlint/package.json')),
  'bin/oxlint',
);

/** Lints `files` (relative path to source) in one oxlint run and returns every finding. */
export function lintFixtures(files: Record<string, string>): Finding[] {
  const root = mkdtempSync(join(tmpdir(), 'oxlint-config-'));
  try {
    writeFileSync(join(root, 'oxlint.config.ts'), `export { default } from '${CONFIG}';\n`);
    for (const [path, source] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), source);
    }
    const run = spawnSync(process.execPath, [OXLINT, '-f', 'json', ...Object.keys(files)], {
      cwd: root,
      encoding: 'utf8',
    });
    if (run.status !== 0 && run.status !== 1) {
      throw new Error(`oxlint exited ${run.status}: ${run.stderr}`);
    }
    const { diagnostics } = JSON.parse(run.stdout) as { diagnostics: Diagnostic[] };
    return diagnostics.map((d) => ({
      file: d.filename,
      rule: d.code,
      message: d.message,
      line: d.labels[0]?.span.line ?? 0,
    }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** The findings of one rule in one file. */
export const findingsOf = (findings: Finding[], file: string, rule: string): Finding[] =>
  findings.filter((f) => f.file === file && f.rule === rule);
