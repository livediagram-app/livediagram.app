import { describe, expect, it } from 'vitest';
import { load } from 'js-yaml';
import { composePart } from './compose';
import { composeIcon, imageName } from './compose-icons';

const partOf = (yaml: string) => {
  const built = composePart(load(yaml) as Record<string, unknown>, 'fallback');
  if (!built.ok) throw new Error(built.error.message);
  return built.part;
};

const edgesOf = (part: ReturnType<typeof partOf>) =>
  part.edges.map(
    (e) => `${e.from}>${e.to}${e.line ? ` ${e.line}` : ''}${e.ends ? ` ${e.ends}` : ''}`,
  );

describe('composePart', () => {
  it('draws services with their icons, notes and dependencies', () => {
    const part = partOf(`
name: shop
services:
  web:
    image: nginx:1.27
    ports: ["8080:80", { published: 8443, target: 443 }, { target: 9000 }]
    depends_on: [api]
  api:
    build: .
    depends_on:
      db: { condition: service_healthy }
      ghost: {}
    links: ["cache:redis-alias"]
  db:
    image: postgres:16
  cache:
    image: bitnami/redis:7
`);
    expect(part.title).toBe('shop');
    expect(part.nodes).toEqual([
      {
        id: 'svc-web',
        label: 'web',
        icon: 'nginx',
        note: 'image: nginx:1.27\nports: 8080:80, 8443:443, 9000',
      },
      { id: 'svc-api', label: 'api', icon: 'docker' },
      { id: 'svc-db', label: 'db', icon: 'postgres', note: 'image: postgres:16' },
      { id: 'svc-cache', label: 'cache', icon: 'redis', note: 'image: bitnami/redis:7' },
    ]);
    // A dependency naming no service (ghost) is dropped.
    expect(edgesOf(part)).toEqual(['svc-web>svc-api', 'svc-api>svc-db', 'svc-api>svc-cache']);
    expect(part.groups).toEqual([]);
  });

  it('draws named volumes as cylinders and leaves bind mounts out', () => {
    const part = partOf(`
services:
  db:
    image: mysql
    volumes:
      - dbdata:/var/lib/mysql
      - ./init:/docker-entrypoint-initdb.d
      - type: volume
        source: logs
        target: /logs
      - type: bind
        source: dbdata
        target: /x
      - 7
volumes:
  dbdata: {}
  logs:
`);
    expect(part.nodes.slice(1)).toEqual([
      { id: 'vol-dbdata', label: 'dbdata', shape: 'cylinder' },
      { id: 'vol-logs', label: 'logs', shape: 'cylinder' },
    ]);
    expect(edgesOf(part)).toEqual(['svc-db>vol-dbdata dashed', 'svc-db>vol-logs dashed']);
  });

  it('frames each network when every service sits on one', () => {
    const part = partOf(`
services:
  web: { image: nginx, networks: [front] }
  api: { networks: { back: {} } }
  db: { networks: [back, default] }
  solo: {}
networks:
  front: {}
  back: {}
`);
    expect(part.groups).toEqual([
      { id: 'net-front', label: 'front network', members: ['svc-web'] },
      { id: 'net-back', label: 'back network', members: ['svc-api', 'svc-db'] },
    ]);
  });

  it('draws networks as hexagons when a service sits on two', () => {
    const part = partOf(`
services:
  web: { networks: [front, back] }
  db: { networks: [back] }
`);
    expect(part.groups).toEqual([]);
    expect(part.nodes.filter((n) => n.shape === 'hexagon').map((n) => n.id)).toEqual([
      'net-front',
      'net-back',
    ]);
    expect(edgesOf(part)).toEqual([
      'svc-web>net-front dashed none',
      'svc-web>net-back dashed none',
      'svc-db>net-back dashed none',
    ]);
  });

  it('names unknown keys, top level and per service, and keeps runtime settings silent', () => {
    const part = partOf(`
version: "3.9"
x-common: &c { restart: always }
include: [other.yml]
secrets: { token: { file: ./t } }
services:
  a: { image: x, environment: [A=1], develop: {}, x-meta: 1, <<: *c }
  b: { develop: {}, gpus: all }
  c:
`);
    expect(part.skipped).toEqual([
      { key: 'include', count: 1 },
      { key: 'secrets', count: 1 },
      { key: 'services.*.develop', count: 2 },
      { key: 'services.*.gpus', count: 1 },
    ]);
    // A service with no settings is still a box.
    expect(part.nodes.map((n) => n.id)).toEqual(['svc-a', 'svc-b', 'svc-c']);
  });

  it('keeps two services whose names slug alike as two boxes', () => {
    const part = partOf('services:\n  web_app: {}\n  web-app: {depends_on: [web_app]}\n');
    expect(part.nodes.map((n) => n.id)).toEqual(['svc-web-app', 'svc-web-app-2']);
    expect(edgesOf(part)).toEqual(['svc-web-app-2>svc-web-app']);
  });

  it('reads past entries it cannot use', () => {
    const part = partOf(`
services:
  web:
    depends_on: [api, 7, ~, api]
    links: [api]
    ports: [~, { published: 80 }]
    volumes: [~, { type: volume }]
  api: {}
`);
    expect(part.nodes[0]).toEqual({
      id: 'svc-web',
      label: 'web',
      icon: 'docker',
      note: 'ports: 80',
    });
    // A dependency given twice, or by depends_on and links both, is one line.
    expect(edgesOf(part)).toEqual(['svc-web>svc-api']);
  });

  it('refuses a file with no services', () => {
    for (const config of [{}, { services: [] }, { services: {} }])
      expect(composePart(config, 'x')).toMatchObject({
        ok: false,
        error: { code: 'no-services', message: 'That Compose file has no services to draw.' },
      });
    expect(partOf('services:\n  a: {}').title).toBe('fallback');
  });
});

describe('composeIcon', () => {
  it('matches the repository name of an image', () => {
    expect(composeIcon('docker.io/library/mongo:7@sha256:abc')).toBe('mongodb');
    expect(composeIcon('confluentinc/cp-kafka:7.5')).toBe('kafka');
    expect(composeIcon('mariadb')).toBe('mysql');
    expect(composeIcon('opensearchproject/opensearch:2')).toBe('elasticsearch');
    expect(composeIcon('node:22-alpine')).toBe('nodejs');
    expect(composeIcon('nodered/node-red')).toBe('docker');
    expect(composeIcon('constructor')).toBe('docker');
    expect(composeIcon('ghcr.io/acme/billing')).toBe('docker');
    expect(composeIcon(undefined)).toBe('docker');
  });

  it('takes the repository name before a tag or digest', () => {
    expect(imageName('registry:5000/team/App:1.2')).toBe('app');
    expect(imageName('redis@sha256:00')).toBe('redis');
  });
});
