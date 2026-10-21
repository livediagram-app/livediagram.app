// Filesystem-safe filename: anything that isn't alphanumeric, a dot, a dash, an underscore or a
// space becomes a dash; runs of dashes collapse and the ends are trimmed, so the name is safe on
// Windows, macOS and Linux.
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^A-Za-z0-9._\- ]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
