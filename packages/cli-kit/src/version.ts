// Comparing the CLI's version with the host's floor for writes (blueprint CLI13), and the way up.

// How to install the newest CLI from npm.
export const upgradeHint = (npmPackage: string): string =>
  `npm install -g ${npmPackage}@latest, or npx ${npmPackage}@latest`;

const parts = (v: string) => v.split('.').map(Number);

// Whether `current` is older than `min`, both x.y.z.
export function isBelow(current: string, min: string): boolean {
  const [a, b] = [parts(current), parts(min)];
  for (let i = 0; i < 3; i++) if (a[i]! !== b[i]!) return a[i]! < b[i]!;
  return false;
}
