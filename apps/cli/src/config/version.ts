// The CLI's own version, and the host's floor for writes (blueprint CLI13).

export const CLI_VERSION = '0.2.1';

// The name npm publishes the CLI under (blueprint CLI1); its command is `livediagram`.
export const NPM_PACKAGE = '@livediagram/cli';

export const UPGRADE_HINT = `npm install -g ${NPM_PACKAGE}@latest, or npx ${NPM_PACKAGE}@latest`;

const parts = (v: string) => v.split('.').map(Number);

// Whether `current` is older than `min`, both x.y.z.
export function isBelow(current: string, min: string): boolean {
  const [a, b] = [parts(current), parts(min)];
  for (let i = 0; i < 3; i++) if (a[i]! !== b[i]!) return a[i]! < b[i]!;
  return false;
}
