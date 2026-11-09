// Comparing the CLI's version with the host's floor for writes (blueprint CLI13), and the way up.

// How to install the newest CLI from npm.
export const upgradeHint = (npmPackage: string): string =>
  `npm install -g ${npmPackage}@latest, or npx ${npmPackage}@latest`;

// x.y.z, then the prerelease's dot-separated identifiers (none for a release). Build metadata (+...) is ignored.
function parse(v: string): { core: number[]; pre: string[] } {
  const [main = '', ...rest] = v.split('+')[0]!.split('-');
  const pre = rest.join('-');
  return { core: main.split('.').map(Number), pre: pre ? pre.split('.') : [] };
}

const NUMERIC = /^\d+$/;

// Semver precedence of two prerelease identifiers: numbers by value and below words, words by ASCII order.
function compareIdentifier(a: string, b: string): number {
  const [an, bn] = [NUMERIC.test(a), NUMERIC.test(b)];
  if (an && bn) return Number(a) - Number(b);
  if (an !== bn) return an ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

// Whether `current` is older than `min` by semver precedence: x.y.z first, then a prerelease
// (1.3.0-rc.1) is older than its release (1.3.0).
export function isBelow(current: string, min: string): boolean {
  const [a, b] = [parse(current), parse(min)];
  for (let i = 0; i < 3; i++) if (a.core[i]! !== b.core[i]!) return a.core[i]! < b.core[i]!;
  if (a.pre.length === 0 || b.pre.length === 0) return a.pre.length > b.pre.length;
  for (let i = 0; i < Math.min(a.pre.length, b.pre.length); i++) {
    const order = compareIdentifier(a.pre[i]!, b.pre[i]!);
    if (order !== 0) return order < 0;
  }
  return a.pre.length < b.pre.length;
}
