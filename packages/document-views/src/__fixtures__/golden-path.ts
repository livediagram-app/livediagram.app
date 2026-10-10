import { fileURLToPath } from 'node:url';

// Where a golden file lives (docs/specs/024-agents/blueprints/document-views.md "Testing", VW52).
//
// `fileURLToPath`, not `URL.pathname`: on Windows the pathname is "/G:/…", and a
// snapshot writer that resolves it against the working directory lands on
// "G:\G:\…" and dies with ENOENT. It also decodes %20, which a pathname leaves in.
export function golden(name: string): string {
  return fileURLToPath(new URL(`./golden/${name}`, import.meta.url));
}
