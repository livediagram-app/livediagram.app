// Two hosts as one site: their origins, a leading `www.` ignored. A file pulled from `https://liveplanner.app` before
// the move to www. (liveworkspace/docs/specs/010-site/site.md "www. is the address") still pushes to `https://www.liveplanner.app`,
// the CLIs' default host since. Throws on a value that isn't a URL, as `new URL` does.
export const sameHost = (a: string, b: string): boolean =>
  new URL(a).origin.replace('://www.', '://') === new URL(b).origin.replace('://www.', '://');
