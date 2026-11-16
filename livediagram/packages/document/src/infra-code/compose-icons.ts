// A Compose service's technology icon from its image (docs/specs/020-import-export/infrastructure-import.md "Docker
// Compose"). Pure data: the image's repository name (the last path part, before any tag or digest) is matched against
// these words; a service no word matches wears the Docker icon.

const BY_WORD: readonly (readonly [word: string, icon: string])[] = [
  ['postgres', 'postgres'],
  ['postgis', 'postgres'],
  ['timescaledb', 'postgres'],
  ['mysql', 'mysql'],
  ['mariadb', 'mysql'],
  ['percona', 'mysql'],
  ['redis', 'redis'],
  ['valkey', 'redis'],
  ['keydb', 'redis'],
  ['mongo', 'mongodb'],
  ['kafka', 'kafka'],
  ['nginx', 'nginx'],
  ['rabbitmq', 'rabbitmq'],
  ['elasticsearch', 'elasticsearch'],
  ['opensearch', 'elasticsearch'],
  ['cassandra', 'cassandra'],
  ['scylla', 'cassandra'],
  ['prometheus', 'prometheus'],
];

// Repository names that are a word only whole: `node` would otherwise match `nodered`, `my-node-exporter`.
const BY_NAME: Readonly<Record<string, string>> = { node: 'nodejs' };

export const COMPOSE_DEFAULT_ICON = 'docker';

/** The repository name of an image reference: `docker.io/bitnami/redis:7.2@sha256:...` is `redis`. */
export function imageName(image: string): string {
  const at = image.indexOf('@');
  const ref = at === -1 ? image : image.slice(0, at);
  const repo = ref.slice(ref.lastIndexOf('/') + 1);
  const colon = repo.indexOf(':');
  return (colon === -1 ? repo : repo.slice(0, colon)).toLowerCase();
}

export function composeIcon(image: string | undefined): string {
  if (!image) return COMPOSE_DEFAULT_ICON;
  const name = imageName(image);
  // Own keys only: an image named `constructor` is no icon.
  if (Object.hasOwn(BY_NAME, name)) return BY_NAME[name]!;
  return BY_WORD.find(([word]) => name.includes(word))?.[1] ?? COMPOSE_DEFAULT_ICON;
}
