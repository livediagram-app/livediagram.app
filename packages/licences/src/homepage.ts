type Manifest = { homepage?: unknown; repository?: unknown };

const GITHUB_SHORTHAND = /^(?:github:)?([\w.-]+\/[\w.-]+)$/;

function https(candidate: string): string | undefined {
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function fromRepository(repository: unknown): string | undefined {
  const raw =
    typeof repository === 'string'
      ? repository
      : typeof repository === 'object' && repository !== null
        ? (repository as { url?: unknown }).url
        : undefined;
  if (typeof raw !== 'string') return undefined;
  const shorthand = GITHUB_SHORTHAND.exec(raw);
  if (shorthand) return `https://github.com/${shorthand[1]}`;
  // `git+ssh://git@host/path` and `git+https://…#branch` are how npm writes many repositories: the ssh form had
  // failed the https check and the fragment stayed on the link, so the work showed no Source link or a broken one.
  return https(
    raw
      .replace(/^git\+/, '')
      .replace(/#.*$/, '')
      .replace(/^git:\/\//, 'https://')
      .replace(/^ssh:\/\/git@([^/:]+)[:/]/, 'https://$1/')
      .replace(/^git@([^:]+):/, 'https://$1/')
      .replace(/\.git$/, ''),
  );
}

// A work's "Source" link on the page (blueprint D8): its homepage, else its
// repository, and only when that resolves to an https URL.
export function homepageFromManifest(manifest: Manifest): string | undefined {
  const homepage = typeof manifest.homepage === 'string' ? https(manifest.homepage) : undefined;
  return homepage ?? fromRepository(manifest.repository);
}
